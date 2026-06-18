import OpenAI from 'openai'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import {
  EMBEDDINGS_OUTPUT_FILE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  readChunksOutput,
  type EmbeddedChunk,
  type EmbeddingsOutput,
  type KnowledgeChunk,
} from '../scripts/knowledgeEmbeddings.js'
import { AiUpstreamError, AiValidationError } from './aiService.js'

const DEFAULT_TOP_K = 5
const MAX_TOP_K = 20

export type KnowledgeMatchInput = {
  question: string
  topK?: number
}

export type KnowledgeMatch = {
  score: number
  chunk: KnowledgeChunk
}

export type KnowledgeMatchResult = {
  question: string
  topK: number
  matches: KnowledgeMatch[]
}

const client = new OpenAI({
  apiKey: env.dashscopeApiKey,
  baseURL: env.dashscopeBaseUrl,
  timeout: env.dashscopeTimeoutMs,
})

export async function matchKnowledge(input: KnowledgeMatchInput): Promise<KnowledgeMatchResult> {
  const normalized = normalizeKnowledgeMatchInput(input)

  try {
    const [chunksOutput, embeddingsOutput, questionEmbedding] = await Promise.all([
      readChunksOutput(),
      readEmbeddingsOutput(),
      embedQuestion(normalized.question),
    ])

    validateEmbeddingsOutput(embeddingsOutput)

    const chunksById = new Map(chunksOutput.chunks.map((chunk) => [chunk.id, chunk]))
    const matches = embeddingsOutput.records
      .map((record) => {
        validateEmbeddedChunk(record)

        const chunk = chunksById.get(record.id)

        if (!chunk) {
          return null
        }

        return {
          score: cosineSimilarity(questionEmbedding, record.embedding),
          chunk,
        }
      })
      .filter((match): match is KnowledgeMatch => match !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, normalized.topK)

    return {
      question: normalized.question,
      topK: normalized.topK,
      matches,
    }
  } catch (error) {
    if (error instanceof AiValidationError || error instanceof AiUpstreamError) {
      throw error
    }

    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Knowledge match failed'

    throw new AiUpstreamError(message)
  }
}

function normalizeKnowledgeMatchInput(input: Partial<KnowledgeMatchInput> | null | undefined) {
  const question = typeof input?.question === 'string' ? input.question.trim() : ''

  if (question.length === 0) {
    throw new AiValidationError('question must be a non-empty string')
  }

  const topK = input?.topK ?? DEFAULT_TOP_K

  if (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K) {
    throw new AiValidationError(`topK must be an integer between 1 and ${MAX_TOP_K}`)
  }

  return {
    question,
    topK,
  }
}

async function embedQuestion(question: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const vector = response.data[0]?.embedding

  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new AiUpstreamError(
      `Invalid question embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, received ${vector?.length ?? 0}`,
    )
  }

  return vector
}

async function readEmbeddingsOutput(filePath = EMBEDDINGS_OUTPUT_FILE): Promise<EmbeddingsOutput> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as Partial<EmbeddingsOutput>

  if (!parsed || !Array.isArray(parsed.records)) {
    throw new Error(`Invalid embeddings file: ${path.relative(process.cwd(), filePath)}`)
  }

  return {
    generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date().toISOString(),
    sourceRoot: typeof parsed.sourceRoot === 'string' ? parsed.sourceRoot : 'knowledge',
    chunkCount: typeof parsed.chunkCount === 'number' ? parsed.chunkCount : parsed.records.length,
    embeddingModel: typeof parsed.embeddingModel === 'string' ? parsed.embeddingModel : EMBEDDING_MODEL,
    embeddingDimensions:
      typeof parsed.embeddingDimensions === 'number' ? parsed.embeddingDimensions : EMBEDDING_DIMENSIONS,
    records: parsed.records as EmbeddedChunk[],
  }
}

function validateEmbeddingsOutput(output: EmbeddingsOutput) {
  if (output.embeddingModel !== EMBEDDING_MODEL) {
    throw new AiUpstreamError(
      `Knowledge embeddings model mismatch: expected ${EMBEDDING_MODEL}, received ${output.embeddingModel}`,
    )
  }

  if (output.embeddingDimensions !== EMBEDDING_DIMENSIONS) {
    throw new AiUpstreamError(
      `Knowledge embeddings dimensions mismatch: expected ${EMBEDDING_DIMENSIONS}, received ${output.embeddingDimensions}`,
    )
  }
}

function validateEmbeddedChunk(record: EmbeddedChunk) {
  if (!Array.isArray(record.embedding) || record.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new AiUpstreamError(
      `Invalid embedding dimensions for chunk ${record.id}: expected ${EMBEDDING_DIMENSIONS}, received ${
        record.embedding?.length ?? 0
      }`,
    )
  }

  if (record.embeddingModel !== EMBEDDING_MODEL) {
    throw new AiUpstreamError(
      `Embedding model mismatch for chunk ${record.id}: expected ${EMBEDDING_MODEL}, received ${record.embeddingModel}`,
    )
  }

  if (record.embeddingDimensions !== EMBEDDING_DIMENSIONS) {
    throw new AiUpstreamError(
      `Embedding dimensions mismatch for chunk ${record.id}: expected ${EMBEDDING_DIMENSIONS}, received ${record.embeddingDimensions}`,
    )
  }
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0
  let leftNormSquared = 0
  let rightNormSquared = 0

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0

    dot += leftValue * rightValue
    leftNormSquared += leftValue * leftValue
    rightNormSquared += rightValue * rightValue
  }

  const denominator = Math.sqrt(leftNormSquared) * Math.sqrt(rightNormSquared)

  return denominator > 0 ? dot / denominator : 0
}
