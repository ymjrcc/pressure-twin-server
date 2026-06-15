import OpenAI from 'openai'
import type { ChatCompletion } from 'openai/resources/chat/completions'
import { env } from '../config/env.js'

const DEFAULT_REASONING_EFFORT = 'low'
const REASONING_EFFORT_VALUES = ['low', 'medium', 'high', 'max'] as const

export type ReasoningEffort = (typeof REASONING_EFFORT_VALUES)[number]

export type ChatInput = {
  message: string
  systemPrompt?: string
  model?: string
  thinking?: boolean
  reasoning_effort?: ReasoningEffort
  stream?: boolean
}

export type ChatResult = {
  reply: string
  model: string
  thinking: boolean
  reasoning_effort: ReasoningEffort
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export class AiValidationError extends Error {
  readonly statusCode = 400
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

export async function createChatCompletion(input: ChatInput): Promise<ChatResult> {
  const normalized = normalizeChatInput(input)

  try {
    const completion = (await client.chat.completions.create({
      model: normalized.model,
      messages: buildMessages(normalized.message, normalized.systemPrompt),
      stream: false,
      reasoning_effort: normalized.reasoningEffort,
      extra_body: {
        thinking: {
          type: normalized.thinking ? 'enabled' : 'disabled',
        },
      },
    } as any)) as ChatCompletion

    const reply = completion.choices[0]?.message?.content

    if (typeof reply !== 'string' || reply.trim().length === 0) {
      throw new AiUpstreamError('DeepSeek returned an empty response')
    }

    const usage = completion.usage

    return {
      reply,
      model: completion.model ?? normalized.model,
      thinking: normalized.thinking,
      reasoning_effort: normalized.reasoningEffort,
      ...(usage
        ? {
            usage: {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
            },
          }
        : {}),
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

function normalizeChatInput(input: ChatInput) {
  if (typeof input.message !== 'string' || input.message.trim().length === 0) {
    throw new AiValidationError('message is required')
  }

  if (input.systemPrompt !== undefined && typeof input.systemPrompt !== 'string') {
    throw new AiValidationError('systemPrompt must be a string')
  }

  if (input.model !== undefined && (typeof input.model !== 'string' || input.model.trim().length === 0)) {
    throw new AiValidationError('model must be a non-empty string')
  }

  if (input.thinking !== undefined && typeof input.thinking !== 'boolean') {
    throw new AiValidationError('thinking must be a boolean')
  }

  if (input.stream !== undefined && typeof input.stream !== 'boolean') {
    throw new AiValidationError('stream must be a boolean')
  }

  if (input.stream === true) {
    throw new AiValidationError('stream=true is not supported yet')
  }

  const reasoningEffort = input.reasoning_effort ?? DEFAULT_REASONING_EFFORT

  if (!REASONING_EFFORT_VALUES.includes(reasoningEffort)) {
    throw new AiValidationError('reasoning_effort must be one of: low, medium, high, max')
  }

  return {
    message: input.message.trim(),
    systemPrompt: input.systemPrompt?.trim() || undefined,
    model: input.model?.trim() || env.deepseekDefaultModel,
    thinking: input.thinking ?? false,
    reasoningEffort,
  }
}

function buildMessages(message: string, systemPrompt?: string) {
  if (!systemPrompt) {
    return [{ role: 'user' as const, content: message }]
  }

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: message },
  ]
}
