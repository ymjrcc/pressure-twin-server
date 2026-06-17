import 'dotenv/config'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import {
  CHUNKS_OUTPUT_FILE,
  type ChunksOutput,
  type FrontmatterData,
  type KnowledgeChunk,
  writeEmbeddingsOutput,
} from './knowledgeEmbeddings.js'

const KNOWLEDGE_ROOT = path.resolve(process.cwd(), 'knowledge')
const OUTPUT_DIR = path.join(KNOWLEDGE_ROOT, 'build')
const TARGET_MIN_CHARS = 500
const TARGET_MAX_CHARS = 900
const OVERLAP_CHARS = 120
const INCLUDE_QA_HELPERS = true

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type AstNode = {
  type: string
  depth?: number
  ordered?: boolean
  value?: string
  alt?: string
  url?: string
  children?: AstNode[]
}

type Section = {
  headings: string[]
  sectionTitle: string
  blocks: string[]
}

async function main() {
  const sourceFiles = await collectMarkdownFiles(KNOWLEDGE_ROOT)
  const chunks: KnowledgeChunk[] = []

  for (const filePath of sourceFiles) {
    const fileChunks = await buildChunksForFile(filePath)
    chunks.push(...fileChunks)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const output: ChunksOutput = {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(process.cwd(), KNOWLEDGE_ROOT),
    documentCount: sourceFiles.length,
    chunkCount: chunks.length,
    chunks,
  }

  await writeFile(CHUNKS_OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(`Knowledge chunks built: ${chunks.length} chunks from ${sourceFiles.length} documents`)
  console.log(path.relative(process.cwd(), CHUNKS_OUTPUT_FILE))

  await writeEmbeddingsOutput(chunks, path.relative(process.cwd(), KNOWLEDGE_ROOT))
}

async function collectMarkdownFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'build') {
        continue
      }

      const nestedFiles = await collectMarkdownFiles(fullPath)
      files.push(...nestedFiles)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue
    }

    const relativePath = path.relative(rootDir, fullPath)
    const normalizedPath = toPosixPath(relativePath)

    if (shouldSkipFile(normalizedPath)) {
      continue
    }

    files.push(fullPath)
  }

  return files.sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function shouldSkipFile(relativePath: string) {
  if (relativePath === 'README.md') {
    return true
  }

  if (!INCLUDE_QA_HELPERS && relativePath.startsWith('special-equipment-kb-starter/04_问答辅助/')) {
    return true
  }

  return false
}

async function buildChunksForFile(filePath: string): Promise<KnowledgeChunk[]> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = matter(raw)
  const sourcePath = toPosixPath(path.relative(KNOWLEDGE_ROOT, filePath))
  const metadata = normalizeFrontmatter(parsed.data)
  const title = pickDocumentTitle(metadata, filePath)
  const documentId = hashId(sourcePath)
  const category = getCategory(sourcePath)
  const documentMetadata = addDerivedMetadata(metadata, category)
  const sections = extractSections(parsed.content, title)

  const chunks = sections.flatMap((section) => {
    const splitContents = splitSectionIntoChunkContents(section.blocks)

    return splitContents.map((content, index) => {
      const contentWithContext = buildContentWithContext(title, section.headings, content)

      return {
        id: hashId(`${documentId}::${section.headings.join('>')}::${index}::${content}`),
        documentId,
        sourcePath,
        fileName: path.basename(filePath),
        title,
        headings: section.headings,
        sectionTitle: section.sectionTitle,
        content,
        contentWithContext,
        charCount: content.length,
        sectionChunkIndex: index,
        sectionChunkCount: splitContents.length,
        documentChunkIndex: 0,
        documentChunkCount: 0,
        metadata: documentMetadata,
      }
    })
  })

  return chunks.map((chunk, index, allChunks) => ({
    ...chunk,
    documentChunkIndex: index,
    documentChunkCount: allChunks.length,
  }))
}

function normalizeFrontmatter(value: unknown): FrontmatterData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const normalizedEntries = Object.entries(value).flatMap(([key, entryValue]) => {
    const normalized = normalizeJsonValue(entryValue)

    if (normalized === undefined) {
      return []
    }

    return [[key, normalized] as const]
  })

  return Object.fromEntries(normalizedEntries)
}

function normalizeJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => normalizeJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined)

    return normalizedItems
  }

  if (typeof value === 'object') {
    const normalizedEntries = Object.entries(value).flatMap(([key, entryValue]) => {
      const normalized = normalizeJsonValue(entryValue)

      if (normalized === undefined) {
        return []
      }

      return [[key, normalized] as const]
    })

    return Object.fromEntries(normalizedEntries)
  }

  return undefined
}

function pickDocumentTitle(metadata: FrontmatterData, filePath: string) {
  const frontmatterTitle = metadata.title

  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim().length > 0) {
    return frontmatterTitle.trim()
  }

  return path.basename(filePath, '.md')
}

function addDerivedMetadata(metadata: FrontmatterData, category: string): FrontmatterData {
  return {
    ...metadata,
    category,
  }
}

function getCategory(sourcePath: string) {
  return sourcePath.split('/')[1] ?? sourcePath
}

function extractSections(markdownContent: string, documentTitle: string): Section[] {
  const tree = unified().use(remarkParse).parse(markdownContent) as AstNode
  const children = tree.children ?? []
  const sections: Section[] = []
  const headingStack: string[] = [documentTitle]
  let currentSection: Section = {
    headings: [documentTitle],
    sectionTitle: documentTitle,
    blocks: [],
  }

  for (const node of children) {
    if (node.type === 'heading' && typeof node.depth === 'number' && node.depth <= 3) {
      if (currentSection.blocks.length > 0) {
        sections.push(finalizeSection(currentSection))
      }

      const headingText = normalizeWhitespace(renderInlineChildren(node.children ?? []))

      if (node.depth === 1) {
        if (headingText.length > 0) {
          headingStack[0] = headingText
        }

        currentSection = {
          headings: [headingStack[0] ?? documentTitle],
          sectionTitle: headingStack[0] ?? documentTitle,
          blocks: [],
        }
        continue
      }

      const nextHeadings = buildHeadingPath(headingStack, node.depth, headingText, documentTitle)
      headingStack.splice(0, headingStack.length, ...nextHeadings)

      currentSection = {
        headings: [...nextHeadings],
        sectionTitle: headingText || nextHeadings[nextHeadings.length - 1] || documentTitle,
        blocks: [],
      }
      continue
    }

    const blockText = renderBlock(node)

    if (blockText.length > 0) {
      currentSection.blocks.push(blockText)
    }
  }

  if (currentSection.blocks.length > 0) {
    sections.push(finalizeSection(currentSection))
  }

  if (sections.length === 0) {
    return [
      {
        headings: [documentTitle],
        sectionTitle: documentTitle,
        blocks: [normalizeWhitespace(markdownContent)],
      },
    ]
  }

  return sections
}

function buildHeadingPath(stack: string[], depth: number, headingText: string, documentTitle: string) {
  const next = stack.slice(0, Math.max(1, depth - 1))

  while (next.length < depth - 1) {
    next.push(next[next.length - 1] ?? documentTitle)
  }

  next[0] = next[0] ?? documentTitle
  next[depth - 1] = headingText || next[depth - 2] || documentTitle

  return next.slice(0, depth)
}

function finalizeSection(section: Section): Section {
  return {
    headings: [...section.headings],
    sectionTitle: section.sectionTitle,
    blocks: section.blocks.map((block) => normalizeWhitespace(block)).filter((block) => block.length > 0),
  }
}

function renderBlock(node: AstNode): string {
  switch (node.type) {
    case 'paragraph':
      return normalizeWhitespace(renderInlineChildren(node.children ?? []))
    case 'list':
      return renderList(node)
    case 'blockquote':
      return normalizeWhitespace(
        (node.children ?? [])
          .map((child) => renderBlock(child))
          .filter((child) => child.length > 0)
          .map((child) => `> ${child}`)
          .join('\n'),
      )
    case 'code':
      return normalizeWhitespace(node.value ?? '')
    case 'thematicBreak':
      return ''
    default:
      if (node.children && node.children.length > 0) {
        return normalizeWhitespace(
          node.children
            .map((child) => renderBlock(child))
            .filter((child) => child.length > 0)
            .join('\n\n'),
        )
      }

      return normalizeWhitespace(node.value ?? '')
  }
}

function renderList(node: AstNode): string {
  const items = node.children ?? []

  return items
    .map((item, index) => {
      const marker = node.ordered ? `${index + 1}. ` : '- '
      const itemText = normalizeWhitespace(
        (item.children ?? [])
          .map((child) => renderBlock(child))
          .filter((child) => child.length > 0)
          .join('\n'),
      )

      return `${marker}${itemText}`
    })
    .filter((item) => item.length > 0)
    .join('\n')
}

function renderInlineChildren(nodes: AstNode[]): string {
  return nodes.map((node) => renderInline(node)).join('')
}

function renderInline(node: AstNode): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
      return node.value ?? ''
    case 'strong':
    case 'emphasis':
    case 'delete':
    case 'heading':
    case 'paragraph':
    case 'link':
    case 'linkReference':
      return renderInlineChildren(node.children ?? [])
    case 'image':
      return node.alt ?? ''
    case 'break':
      return '\n'
    default:
      if (node.children && node.children.length > 0) {
        return renderInlineChildren(node.children)
      }

      return node.value ?? ''
  }
}

function splitSectionIntoChunkContents(blocks: string[]) {
  const normalizedBlocks = blocks.flatMap((block) => splitOversizedBlock(block))
  const rawChunks: string[] = []
  let currentChunkBlocks: string[] = []

  for (const block of normalizedBlocks) {
    const candidateBlocks = [...currentChunkBlocks, block]
    const candidateText = joinBlocks(candidateBlocks)

    if (candidateText.length <= TARGET_MAX_CHARS) {
      currentChunkBlocks = candidateBlocks
      continue
    }

    if (currentChunkBlocks.length === 0) {
      rawChunks.push(block)
      continue
    }

    rawChunks.push(joinBlocks(currentChunkBlocks))

    if (joinBlocks(currentChunkBlocks).length < TARGET_MIN_CHARS) {
      currentChunkBlocks = [block]
    } else {
      currentChunkBlocks = [block]
    }
  }

  if (currentChunkBlocks.length > 0) {
    rawChunks.push(joinBlocks(currentChunkBlocks))
  }

  return rawChunks.map((chunk, index) => {
    if (index === 0) {
      return chunk
    }

    const overlapPrefix = rawChunks[index - 1]?.slice(-OVERLAP_CHARS).trim() ?? ''

    if (overlapPrefix.length === 0) {
      return chunk
    }

    return normalizeWhitespace(`${overlapPrefix}\n${chunk}`)
  })
}

function splitOversizedBlock(block: string) {
  if (block.length <= TARGET_MAX_CHARS) {
    return [block]
  }

  const units = splitIntoSentenceUnits(block)
  const chunks: string[] = []
  let current = ''

  for (const unit of units) {
    const candidate = current.length === 0 ? unit : `${current}${unit}`

    if (candidate.length <= TARGET_MAX_CHARS) {
      current = candidate
      continue
    }

    if (current.length > 0) {
      chunks.push(current.trim())
    }

    if (unit.length <= TARGET_MAX_CHARS) {
      current = unit
      continue
    }

    const hardParts = hardSplit(unit, TARGET_MAX_CHARS)
    chunks.push(...hardParts.slice(0, -1).map((part) => part.trim()))
    current = hardParts[hardParts.length - 1] ?? ''
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim())
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

function splitIntoSentenceUnits(text: string) {
  const matches = text.match(/[^。！？；\n]+[。！？；\n]*/g)

  if (!matches) {
    return [text]
  }

  return matches.map((part) => part.trim()).filter((part) => part.length > 0)
}

function hardSplit(text: string, maxChars: number) {
  const parts: string[] = []
  let start = 0

  while (start < text.length) {
    parts.push(text.slice(start, start + maxChars))
    start += maxChars
  }

  return parts
}

function joinBlocks(blocks: string[]) {
  return normalizeWhitespace(blocks.join('\n\n'))
}

function buildContentWithContext(title: string, headings: string[], content: string) {
  const sectionPath = headings.join(' > ')
  return `文档标题：${title}\n章节：${sectionPath}\n正文：${content}`
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \u00A0]{2,}/g, ' ')
    .trim()
}

function hashId(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join('/')
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
