import OpenAI from 'openai'
import type { ChatCompletion } from 'openai/resources/chat/completions'
import { z } from 'zod'
import { env } from '../config/env.js'
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

export type ParsedInspectionReport = z.infer<typeof parsedInspectionReportSchema>

export type ParseInspectionReportInput = {
  reportId: number
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

function normalizeParseInspectionReportInput(input: ParseInspectionReportInput) {
  if (!Number.isInteger(input.reportId) || input.reportId <= 0) {
    throw new AiValidationError('reportId must be a positive integer')
  }

  return {
    reportId: input.reportId,
  }
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
