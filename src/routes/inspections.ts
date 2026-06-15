import type { FastifyInstance } from 'fastify'
import {
  createInspectionReport,
  getInspectionReportDetail,
  isInspectionValidationError,
  listInspectionReports,
} from '../services/inspectionService.js'
import type { CreateInspectionReportInput } from '../types/inspection.js'

export async function inspectionRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    ok: true,
    data: await listInspectionReports(),
  }))

  app.get<{
    Params: {
      reportId: string
    }
  }>('/:reportId', async (request, reply) => {
    const reportId = Number(request.params.reportId)

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return reply.code(400).send({
        ok: false,
        error: {
          message: 'Invalid reportId',
        },
      })
    }

    const report = await getInspectionReportDetail(reportId)

    if (!report) {
      return reply.code(404).send({
        ok: false,
        error: {
          message: 'Inspection report not found',
        },
      })
    }

    return {
      ok: true,
      data: report,
    }
  })

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
