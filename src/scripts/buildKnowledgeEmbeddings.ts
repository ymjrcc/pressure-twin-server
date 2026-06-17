import 'dotenv/config'
import { readChunksOutput, writeEmbeddingsOutput } from './knowledgeEmbeddings.js'

async function main() {
  const chunksOutput = await readChunksOutput()

  console.log(
    `Loaded ${chunksOutput.chunks.length} chunks from ${chunksOutput.sourceRoot} (${chunksOutput.documentCount} documents)`,
  )

  await writeEmbeddingsOutput(chunksOutput.chunks, chunksOutput.sourceRoot)
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
