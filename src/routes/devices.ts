import type { FastifyInstance } from 'fastify'
import { getDeviceByCode, listDevices } from '../services/deviceService.js'

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const devices = await listDevices()

    return {
      ok: true,
      data: devices
    }
  })

  app.get<{
    Params: {
      code: string
    }
  }>('/:code', async (request, reply) => {
    const device = await getDeviceByCode(request.params.code)

    if (!device) {
      return reply.code(404).send({
        ok: false,
        error: {
          message: 'Device not found'
        }
      })
    }

    return {
      ok: true,
      data: device
    }
  })
}
