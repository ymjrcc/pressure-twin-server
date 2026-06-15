import type { FastifyInstance } from 'fastify'
import {
  parseInspectionReport,
  isAiUpstreamError,
  isAiValidationError,
} from '../services/aiService.js'

type ParseInspectionReportBody = {
  reportId: number
}

export async function aiRoutes(app: FastifyInstance) {
  app.post<{
    Body: ParseInspectionReportBody
  }>('/parse-inspection-report', async (request, reply) => {
    try {
      const result = await parseInspectionReport(request.body)

      return {
        ok: true,
        data: result,
      }
    } catch (error) {
      if (isAiValidationError(error) || isAiUpstreamError(error)) {
        if (error.statusCode === 502) {
          request.log.error(
            {
              reportId: request.body?.reportId,
              error: error.message,
            },
            'Failed to parse inspection report with DeepSeek',
          )
        }

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
