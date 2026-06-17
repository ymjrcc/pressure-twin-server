import OpenAI from 'openai'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'

const KNOWLEDGE_ROOT = path.resolve(process.cwd(), 'knowledge')
const OUTPUT_DIR = path.join(KNOWLEDGE_ROOT, 'build')

export const CHUNKS_OUTPUT_FILE = path.join(OUTPUT_DIR, 'chunks.json')
export const EMBEDDINGS_OUTPUT_FILE = path.join(OUTPUT_DIR, 'embeddings.json')
export const EMBEDDING_MODEL = 'text-embedding-v4'
export const EMBEDDING_DIMENSIONS = 1024
export const EMBEDDING_BATCH_SIZE = 10

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type FrontmatterData = Record<string, JsonValue>

export type KnowledgeChunk = {
  id: string
  documentId: string
  sourcePath: string
  fileName: string
  title: string
  headings: string[]
  sectionTitle: string
  content: string
  contentWithContext: string
  charCount: number
  sectionChunkIndex: number
  sectionChunkCount: number
  documentChunkIndex: number
  documentChunkCount: number
  metadata: FrontmatterData
}

export type EmbeddableChunk = Pick<KnowledgeChunk, 'id' | 'documentId' | 'contentWithContext'>

export type ChunksOutput = {
  generatedAt: string
  sourceRoot: string
  documentCount: number
  chunkCount: number
  chunks: KnowledgeChunk[]
}

export type EmbeddedChunk = {
  id: string
  documentId: string
  embeddingModel: string
  embeddingDimensions: number
  embedding: number[]
}

export type EmbeddingsOutput = {
  generatedAt: string
  sourceRoot: string
  chunkCount: number
  embeddingModel: string
  embeddingDimensions: number
  records: EmbeddedChunk[]
}

const openai = new OpenAI({
  apiKey: env.dashscopeApiKey,
  baseURL: env.dashscopeBaseUrl,
  timeout: env.dashscopeTimeoutMs,
})

export async function buildEmbeddings(chunks: EmbeddableChunk[]): Promise<EmbeddedChunk[]> {
  const records: EmbeddedChunk[] = []

  for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE)
    const batchNumber = Math.floor(start / EMBEDDING_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)

    console.log(`Embedding batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`)

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((chunk) => chunk.contentWithContext),
      dimensions: EMBEDDING_DIMENSIONS,
    })

    if (response.data.length !== batch.length) {
      throw new Error(
        `Embedding response count mismatch: expected ${batch.length}, received ${response.data.length}`,
      )
    }

    for (const [index, chunk] of batch.entries()) {
      const vector = response.data[index]?.embedding

      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Invalid embedding dimensions for chunk ${chunk.id}: expected ${EMBEDDING_DIMENSIONS}, received ${vector?.length ?? 0}`,
        )
      }

      records.push({
        id: chunk.id,
        documentId: chunk.documentId,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        embedding: vector,
      })
    }
  }

  return records
}

export async function writeEmbeddingsOutput(chunks: KnowledgeChunk[], sourceRoot: string) {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const records = await buildEmbeddings(toEmbeddableChunks(chunks))
  const output: EmbeddingsOutput = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    chunkCount: records.length,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    records,
  }

  await writeFile(EMBEDDINGS_OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(`Knowledge embeddings built: ${records.length} vectors`)
  console.log(path.relative(process.cwd(), EMBEDDINGS_OUTPUT_FILE))
}

function toEmbeddableChunks(chunks: KnowledgeChunk[]): EmbeddableChunk[] {
  return chunks.map(({ id, documentId, contentWithContext }) => ({
    id,
    documentId,
    contentWithContext,
  }))
}

export async function readChunksOutput(filePath = CHUNKS_OUTPUT_FILE): Promise<ChunksOutput> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as Partial<ChunksOutput>

  if (!parsed || !Array.isArray(parsed.chunks)) {
    throw new Error(`Invalid chunks file: ${path.relative(process.cwd(), filePath)}`)
  }

  return {
    generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date().toISOString(),
    sourceRoot: typeof parsed.sourceRoot === 'string' ? parsed.sourceRoot : path.relative(process.cwd(), KNOWLEDGE_ROOT),
    documentCount: typeof parsed.documentCount === 'number' ? parsed.documentCount : 0,
    chunkCount: typeof parsed.chunkCount === 'number' ? parsed.chunkCount : parsed.chunks.length,
    chunks: parsed.chunks as KnowledgeChunk[],
  }
}
