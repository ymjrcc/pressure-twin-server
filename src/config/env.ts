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
  deepseekApiKey: getRequiredEnv('DEEPSEEK_API_KEY'),
  deepseekTimeoutMs: getNumberEnv('DEEPSEEK_TIMEOUT_MS', 120000),
  port: Number(process.env.PORT ?? 3003),
} as const
