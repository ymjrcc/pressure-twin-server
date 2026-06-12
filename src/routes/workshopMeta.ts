import type { FastifyInstance } from 'fastify'
import {
  getInspectionChecklists,
  getInstruments,
  getProcessFlowSteps,
  getTelemetryConfigs,
} from '../services/workshopMetaService.js'

export async function workshopMetaRoutes(app: FastifyInstance) {
  app.get('/inspection-checklists', async () => ({
    ok: true,
    data: await getInspectionChecklists(),
  }))

  app.get('/instruments', async () => ({
    ok: true,
    data: await getInstruments(),
  }))

  app.get('/process-flow', async () => ({
    ok: true,
    data: await getProcessFlowSteps(),
  }))

  app.get('/telemetry-configs', async () => ({
    ok: true,
    data: await getTelemetryConfigs(),
  }))
}
