function getRequiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  dashscopeApiKey: getRequiredEnv('DASHSCOPE_API_KEY'),
  dashscopeBaseUrl:
    process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  dashscopeTimeoutMs: getNumberEnv('DASHSCOPE_TIMEOUT_MS', 30000),
  deepseekApiKey: getRequiredEnv('DEEPSEEK_API_KEY'),
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  deepseekDefaultModel: process.env.DEEPSEEK_DEFAULT_MODEL ?? 'deepseek-v4-flash',
  deepseekTimeoutMs: getNumberEnv('DEEPSEEK_TIMEOUT_MS', 120000),
  port: Number(process.env.PORT ?? 3003),
} as const
