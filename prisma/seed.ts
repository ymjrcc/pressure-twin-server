import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { devices } from '../workshopDevices.js'

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({
  url: databaseUrl
})
const prisma = new PrismaClient({
  adapter
})

for (const [deviceIndex, device] of devices.entries()) {
  await prisma.device.upsert({
    where: {
      code: device.code
    },
    create: {
      code: device.code,
      name: device.name,
      description: device.description,
      status: device.status,
      thumbnailType: device.thumbnailType,
      positionX: device.position[0],
      positionY: device.position[1],
      positionZ: device.position[2],
      haloPositionX: device.haloPosition[0],
      haloPositionY: device.haloPosition[1],
      haloPositionZ: device.haloPosition[2],
      haloRadius: device.haloRadius,
      sortOrder: deviceIndex
    },
    update: {
      name: device.name,
      description: device.description,
      status: device.status,
      thumbnailType: device.thumbnailType,
      positionX: device.position[0],
      positionY: device.position[1],
      positionZ: device.position[2],
      haloPositionX: device.haloPosition[0],
      haloPositionY: device.haloPosition[1],
      haloPositionZ: device.haloPosition[2],
      haloRadius: device.haloRadius,
      sortOrder: deviceIndex
    }
  })

  await prisma.deviceParameter.deleteMany({
    where: {
      deviceCode: device.code
    }
  })

  if (device.parameters.length > 0) {
    await prisma.deviceParameter.createMany({
      data: device.parameters.map((parameter, parameterIndex) => ({
        deviceCode: device.code,
        label: parameter.label,
        value: parameter.value,
        unit: parameter.unit ?? null,
        status: parameter.status ?? null,
        sortOrder: parameterIndex
      }))
    })
  }
}

await prisma.$disconnect()
