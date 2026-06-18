import OpenAI from 'openai'
import type { ChatCompletion } from 'openai/resources/chat/completions'
import { z } from 'zod'
import { env } from '../config/env.js'
import type { KnowledgeChunk } from '../scripts/knowledgeEmbeddings.js'
import { buildInspectionReportParseContext } from './inspectionService.js'

const REPORT_PARSE_SYSTEM_PROMPT = `你是一名工业设备巡检报告解析助手。你的任务是根据提供的巡检报告上下文，输出固定 JSON，用于前端直接展示结构化结论。

你会收到一份 JSON 格式的巡检报告上下文，其中包含：
1. 报告的整体统计信息
2. 每台设备的基础信息
3. 每台设备的巡检检查项结果
4. 巡检人员备注 note

请基于这些信息，输出且仅输出一个 JSON 对象，结构必须严格符合以下 schema：

{
  "summary": string,
  "overallStatus": "normal" | "warning" | "critical",
  "abnormalDevices": [
    {
      "deviceCode": string,
      "deviceName": string,
      "abnormalItemCount": number,
      "abnormalItems": string[],
      "note": string,
      "riskLevel": "low" | "medium" | "high",
      "issueSummary": string,
      "recommendation": string
    }
  ],
  "risks": string[],
  "recommendations": string[]
}

判定要求：
- \`summary\`：用 1 到 2 句话概括整份报告的总体情况。
- \`overallStatus\`：
  - 全部正常且无明显风险时为 \`normal\`
  - 存在少量异常或轻微风险时为 \`warning\`
  - 存在明显异常、影响运行安全或需要优先处理时为 \`critical\`
- \`abnormalDevices\`：只列出存在异常项或备注中明确提到异常迹象的设备。
- \`abnormalItems\`：填写异常检查项的 label，不要填写 itemId。
- \`riskLevel\`：根据异常项数量、备注严重程度、设备职责综合判断。
- \`issueSummary\`：简洁描述该设备的问题，不要照抄原始 note。
- \`recommendation\`：给出可执行的处理建议。
- \`risks\`：总结全局层面的风险点。
- \`recommendations\`：总结全局层面的处理建议。

严格限制：
- 只返回 JSON，不要返回 Markdown，不要使用代码块。
- 不要添加 schema 之外的字段。
- 如果某项没有内容，也必须返回合法字段；数组可返回空数组。
- 不要编造输入中完全不存在的设备或检查项，但可以基于已有异常做合理归纳。`

const KNOWLEDGE_SYSTEM_PROMPT = `你是承压类特种设备知识库助手。你必须只根据提供的参考资料回答问题。

输出必须是 JSON 对象：
{
  "answer": string,
  "usedRefs": string[],
  "isGroundedEnough": boolean,
  "insufficientReason": string | null
}

规则：
1. 不得使用参考资料之外的知识补充具体法规、数值、周期或处理结论。
2. 回答中的每个关键判断、处理动作、法规性要求或安全结论都必须在句尾标注来源，例如 [资料1]。
3. usedRefs 只能填写 answer 中实际引用过的资料编号，例如 ["资料1", "资料3"]；不要填写未被 answer 使用的资料。
4. 如果参考资料不足以支持明确结论，isGroundedEnough 必须为 false，并在 answer 和 insufficientReason 中说明当前知识库没有找到充分依据。
5. 不得伪造法规名称、条款、章节、数值和来源。
6. 可以对参考资料进行归纳，但不得改变原意。
7. 只返回 JSON，不要返回 Markdown 代码块。`

const parsedInspectionReportSchema = z.object({
  summary: z.string().min(1),
  overallStatus: z.enum(['normal', 'warning', 'critical']),
  abnormalDevices: z.array(
    z
      .object({
        deviceCode: z.string().min(1),
        deviceName: z.string().min(1),
        abnormalItemCount: z.number().int().nonnegative(),
        abnormalItems: z.array(z.string().min(1)),
        note: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
        issueSummary: z.string().min(1),
        recommendation: z.string().min(1),
      })
      .strict(),
  ),
  risks: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)),
}).strict()

const knowledgeAnswerReplySchema = z.object({
  answer: z.string().min(1),
  usedRefs: z.array(z.string().regex(/^资料\d+$/)),
  isGroundedEnough: z.boolean(),
  insufficientReason: z.string().min(1).nullable(),
}).strict()

export type ParsedInspectionReport = z.infer<typeof parsedInspectionReportSchema>

type KnowledgeAnswerReply = z.infer<typeof knowledgeAnswerReplySchema>

export type ParseInspectionReportInput = {
  reportId: number
}

export type KnowledgeAnswerInput = {
  question: string
  topK?: number
  matches: KnowledgeAnswerMatchInput[]
}

export type KnowledgeAnswerMatchInput = {
  score: number
  chunk: KnowledgeChunk
}

export type KnowledgeAnswerCitation = {
  ref: string
  chunkId: string
  title: string
  sourcePath: string
  sectionTitle: string
  score: number
}

export type KnowledgeAnswerResult = KnowledgeAnswerReply & {
  question: string
  citations: KnowledgeAnswerCitation[]
}

export class AiValidationError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AiValidationError'
    this.statusCode = statusCode
  }
}

export class AiUpstreamError extends Error {
  readonly statusCode = 502
}

const client = new OpenAI({
  apiKey: env.deepseekApiKey,
  baseURL: env.deepseekBaseUrl,
  timeout: env.deepseekTimeoutMs,
})

export function isAiValidationError(error: unknown): error is AiValidationError {
  return error instanceof AiValidationError
}

export function isAiUpstreamError(error: unknown): error is AiUpstreamError {
  return error instanceof AiUpstreamError
}

export async function parseInspectionReport(input: ParseInspectionReportInput): Promise<ParsedInspectionReport> {
  const normalized = normalizeParseInspectionReportInput(input)
  const context = await buildInspectionReportParseContext(normalized.reportId)

  if (!context) {
    throw new AiValidationError('Inspection report not found', 404)
  }

  try {
    const completion = (await client.chat.completions.create({
      model: env.deepseekDefaultModel,
      messages: [
        { role: 'system', content: REPORT_PARSE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `以下是巡检报告上下文，请按要求输出结果：\n\n${JSON.stringify(context, null, 2)}`,
        },
      ],
      stream: false,
      response_format: {
        type: 'json_object',
      },
    } as any)) as ChatCompletion

    const reply = completion.choices[0]?.message?.content

    if (typeof reply !== 'string' || reply.trim().length === 0) {
      throw new AiUpstreamError('DeepSeek returned an empty response')
    }

    const parsedReply = parseJsonReply(reply)
    const validated = parsedInspectionReportSchema.safeParse(parsedReply)

    if (!validated.success) {
      const issues = validated.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')

      throw new AiUpstreamError(`DeepSeek returned invalid report JSON: ${issues}`)
    }

    return validated.data
  } catch (error) {
    if (isAiValidationError(error) || isAiUpstreamError(error)) {
      throw error
    }

    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'DeepSeek request failed'

    throw new AiUpstreamError(message)
  }
}

export async function answerKnowledgeQuestion(input: unknown): Promise<KnowledgeAnswerResult> {
  const normalized = normalizeKnowledgeAnswerInput(input)

  try {
    const completion = (await client.chat.completions.create({
      model: env.deepseekDefaultModel,
      messages: [
        { role: 'system', content: KNOWLEDGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildKnowledgeAnswerPrompt(normalized),
        },
      ],
      stream: false,
      response_format: {
        type: 'json_object',
      },
    } as any)) as ChatCompletion

    const reply = completion.choices[0]?.message?.content

    if (typeof reply !== 'string' || reply.trim().length === 0) {
      throw new AiUpstreamError('DeepSeek returned an empty response')
    }

    const parsedReply = parseJsonReply(reply)
    const validated = knowledgeAnswerReplySchema.safeParse(parsedReply)

    if (!validated.success) {
      const issues = validated.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')

      throw new AiUpstreamError(`DeepSeek returned invalid knowledge answer JSON: ${issues}`)
    }

    const usedRefs = validateUsedRefs(validated.data.usedRefs, normalized.matches.length)

    return {
      question: normalized.question,
      answer: validated.data.answer,
      usedRefs,
      citations: buildKnowledgeAnswerCitations(normalized.matches, usedRefs),
      isGroundedEnough: validated.data.isGroundedEnough,
      insufficientReason: validated.data.insufficientReason,
    }
  } catch (error) {
    if (isAiValidationError(error) || isAiUpstreamError(error)) {
      throw error
    }

    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'DeepSeek request failed'

    throw new AiUpstreamError(message)
  }
}

function normalizeParseInspectionReportInput(input: ParseInspectionReportInput) {
  if (!Number.isInteger(input.reportId) || input.reportId <= 0) {
    throw new AiValidationError('reportId must be a positive integer')
  }

  return {
    reportId: input.reportId,
  }
}

function normalizeKnowledgeAnswerInput(input: unknown): KnowledgeAnswerInput {
  const payload = unwrapKnowledgeAnswerPayload(input)
  const question = typeof payload.question === 'string' ? payload.question.trim() : ''

  if (question.length === 0) {
    throw new AiValidationError('question must be a non-empty string')
  }

  if (!Array.isArray(payload.matches) || payload.matches.length === 0) {
    throw new AiValidationError('matches must be a non-empty array')
  }

  const normalized: KnowledgeAnswerInput = {
    question,
    matches: payload.matches.map(normalizeKnowledgeAnswerMatch),
  }

  if (typeof payload.topK === 'number') {
    normalized.topK = payload.topK
  }

  return normalized
}

function unwrapKnowledgeAnswerPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new AiValidationError('request body must be an object')
  }

  if (input.ok === true && isRecord(input.data)) {
    return input.data
  }

  return input
}

function normalizeKnowledgeAnswerMatch(match: unknown, index: number): KnowledgeAnswerMatchInput {
  if (!isRecord(match)) {
    throw new AiValidationError(`matches[${index}] must be an object`)
  }

  const score = match.score

  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new AiValidationError(`matches[${index}].score must be a finite number`)
  }

  if (!isRecord(match.chunk)) {
    throw new AiValidationError(`matches[${index}].chunk must be an object`)
  }

  const chunk = normalizeKnowledgeAnswerChunk(match.chunk, index)

  return {
    score,
    chunk,
  }
}

function normalizeKnowledgeAnswerChunk(chunk: Record<string, unknown>, index: number): KnowledgeChunk {
  const id = getRequiredString(chunk, 'id', index)
  const title = getRequiredString(chunk, 'title', index)
  const sourcePath = getRequiredString(chunk, 'sourcePath', index)
  const sectionTitle = getRequiredString(chunk, 'sectionTitle', index)
  const content = getRequiredString(chunk, 'content', index)

  return {
    id,
    documentId: typeof chunk.documentId === 'string' ? chunk.documentId : '',
    sourcePath,
    fileName: typeof chunk.fileName === 'string' ? chunk.fileName : '',
    title,
    headings: Array.isArray(chunk.headings)
      ? chunk.headings.filter((heading): heading is string => typeof heading === 'string')
      : [],
    sectionTitle,
    content,
    contentWithContext: typeof chunk.contentWithContext === 'string' ? chunk.contentWithContext : content,
    charCount: typeof chunk.charCount === 'number' ? chunk.charCount : content.length,
    sectionChunkIndex: typeof chunk.sectionChunkIndex === 'number' ? chunk.sectionChunkIndex : 0,
    sectionChunkCount: typeof chunk.sectionChunkCount === 'number' ? chunk.sectionChunkCount : 1,
    documentChunkIndex: typeof chunk.documentChunkIndex === 'number' ? chunk.documentChunkIndex : 0,
    documentChunkCount: typeof chunk.documentChunkCount === 'number' ? chunk.documentChunkCount : 1,
    metadata: {},
  }
}

function getRequiredString(chunk: Record<string, unknown>, key: string, index: number) {
  const value = chunk[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AiValidationError(`matches[${index}].chunk.${key} must be a non-empty string`)
  }

  return value.trim()
}

function buildKnowledgeAnswerPrompt(input: KnowledgeAnswerInput) {
  const references = input.matches
    .map((match, index) => {
      const ref = `资料${index + 1}`
      const headings = match.chunk.headings.length > 0 ? match.chunk.headings.join(' > ') : match.chunk.sectionTitle

      return [
        `[${ref}]`,
        `标题：${match.chunk.title}`,
        `章节：${headings}`,
        `来源路径：${match.chunk.sourcePath}`,
        `相似度：${match.score.toFixed(6)}`,
        `正文：${match.chunk.content}`,
      ].join('\n')
    })
    .join('\n\n')

  return `问题：${input.question}

参考资料：
${references}`
}

function validateUsedRefs(usedRefs: string[], matchCount: number) {
  const uniqueRefs = [...new Set(usedRefs)]

  for (const ref of uniqueRefs) {
    const refIndex = Number(ref.replace('资料', ''))

    if (!Number.isInteger(refIndex) || refIndex < 1 || refIndex > matchCount) {
      throw new AiUpstreamError(`DeepSeek returned an unknown reference: ${ref}`)
    }
  }

  return uniqueRefs
}

function buildKnowledgeAnswerCitations(
  matches: KnowledgeAnswerMatchInput[],
  usedRefs: string[],
): KnowledgeAnswerCitation[] {
  const usedRefSet = new Set(usedRefs)

  return matches.flatMap((match, index) => {
    const ref = `资料${index + 1}`

    if (!usedRefSet.has(ref)) {
      return []
    }

    return [
      {
        ref,
        chunkId: match.chunk.id,
        title: match.chunk.title,
        sourcePath: match.chunk.sourcePath,
        sectionTitle: match.chunk.sectionTitle,
        score: match.score,
      },
    ]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonReply(reply: string) {
  try {
    return JSON.parse(reply)
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Failed to parse reply as JSON'

    throw new AiUpstreamError(`DeepSeek returned non-JSON content: ${message}`)
  }
}
