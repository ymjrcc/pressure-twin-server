import type { FastifyInstance } from 'fastify'
import {
  createChatCompletion,
  isAiUpstreamError,
  isAiValidationError,
} from '../services/aiService.js'

type ChatBody = {
  message: string
  systemPrompt?: string
  model?: string
  thinking?: boolean
  reasoning_effort?: 'low' | 'medium' | 'high' | 'max'
  stream?: boolean
}

export async function aiRoutes(app: FastifyInstance) {
  app.post<{
    Body: ChatBody
  }>('/chat', async (request, reply) => {
    try {
      const result = await createChatCompletion(request.body)

      return {
        ok: true,
        data: result,
      }
    } catch (error) {
      if (isAiValidationError(error) || isAiUpstreamError(error)) {
        return reply.code(error.statusCode).send({
          ok: false,
          error: {
            message: error.message,
          },
        })
      }

      throw error
    }
  })
}
