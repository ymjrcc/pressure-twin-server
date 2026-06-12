import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { deviceRoutes } from './routes/devices.js'
import { workshopMetaRoutes } from './routes/workshopMeta.js'
// import { inspectionRoutes } from './routes/inspections.js'

export async function buildApp() {
  const app = Fastify({
    logger: true
  })

  await app.register(cors, {
    origin: true
  })

  await app.register(healthRoutes, {
    prefix: '/health'
  })

  await app.register(deviceRoutes, {
    prefix: '/api/devices'
  })

  await app.register(workshopMetaRoutes, {
    prefix: '/api'
  })

  // await app.register(inspectionRoutes, {
  //   prefix: '/api/inspections'
  // })

  return app
}
