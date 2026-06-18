import 'dotenv/config'
import { answerKnowledgeQuestion } from '../services/aiService.js'
import { matchKnowledge } from '../services/knowledgeRetrievalService.js'

const DEFAULT_QUESTION = '压力表异常应该怎么处理？'
const DEFAULT_TOP_K = 5

async function main() {
  const question = process.argv[2]?.trim() || DEFAULT_QUESTION
  const topK = parseTopK(process.argv[3])

  console.log('=== Knowledge QA Test ===')
  console.log('Question:', question)
  console.log('Top K:', topK)
  console.log('')

  console.log('Step 1: running /knowledge-match logic...')
  const matchStartedAt = Date.now()
  const matchResult = await matchKnowledge({
    question,
    topK,
  })

  console.log(`Step 1 completed in ${Date.now() - matchStartedAt}ms`)
  console.log('Matched chunks summary:')
  console.log(
    JSON.stringify(
      matchResult.matches.map((match, index) => ({
        ref: `资料${index + 1}`,
        score: match.score,
        chunkId: match.chunk.id,
        title: match.chunk.title,
        sectionTitle: match.chunk.sectionTitle,
        sourcePath: match.chunk.sourcePath,
        contentPreview: preview(match.chunk.content),
      })),
      null,
      2,
    ),
  )
  console.log('')

  console.log('Step 2: running /knowledge-answer logic...')
  const answerStartedAt = Date.now()
  const answerResult = await answerKnowledgeQuestion(matchResult)

  console.log(`Step 2 completed in ${Date.now() - answerStartedAt}ms`)
  console.log('Answer result:')
  console.log(JSON.stringify(answerResult, null, 2))
}

function parseTopK(rawValue: string | undefined) {
  if (!rawValue) {
    return DEFAULT_TOP_K
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed)) {
    throw new Error('topK argument must be an integer')
  }

  return parsed
}

function preview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()

  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error('Knowledge QA test failed:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  } else {
    console.error('Knowledge QA test failed:', error)
  }

  process.exitCode = 1
})
