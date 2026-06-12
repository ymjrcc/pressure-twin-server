import type { FastifyInstance } from 'fastify'
import { createInspectionReport, isInspectionValidationError } from '../services/inspectionService.js'
import type { CreateInspectionReportInput } from '../types/inspection.js'

export async function inspectionRoutes(app: FastifyInstance) {
  app.post<{
    Body: CreateInspectionReportInput
  }>('/', async (request, reply) => {
    try {
      const result = await createInspectionReport(request.body)

      return {
        ok: true,
        data: result
      }
    } catch (error) {
      if (isInspectionValidationError(error)) {
        return reply.code(error.statusCode).send({
          ok: false,
          error: {
            message: error.message
          }
        })
      }

      throw error
    }
  })
}
