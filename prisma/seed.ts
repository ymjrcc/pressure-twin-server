import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { telemetryMetricConfigs } from '../src/seed-data/telemetry.js'
import { devices, inspectionChecklists, instruments, processFlowSteps } from '../src/seed-data/workshop.js'

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({
  url: databaseUrl
})
const prisma = new PrismaClient({
  adapter
})

async function seedDevices() {
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
}

async function seedWorkshopMeta() {
  await prisma.inspectionChecklistItem.deleteMany()
  await prisma.instrument.deleteMany()
  await prisma.processFlowStep.deleteMany()
  await prisma.telemetryMetricThreshold.deleteMany()
  await prisma.telemetryMetricConfig.deleteMany()

  await prisma.inspectionChecklistItem.createMany({
    data: Object.entries(inspectionChecklists).flatMap(([deviceCode, checklist]) =>
      checklist.map((item, sortOrder) => ({
        deviceCode,
        itemId: item.id,
        label: item.label,
        description: item.description,
        sortOrder
      }))
    )
  })

  await prisma.instrument.createMany({
    data: instruments.map((instrument, sortOrder) => ({
      code: instrument.code,
      name: instrument.name,
      sortOrder
    }))
  })

  await prisma.processFlowStep.createMany({
    data: processFlowSteps.map((step, sortOrder) => ({
      code: step.code,
      description: step.description,
      deviceName: step.deviceName,
      status: step.status ?? null,
      title: step.title,
      variant: step.variant ?? null,
      sortOrder
    }))
  })
}

async function seedTelemetryConfigs() {
  for (const [deviceCode, configs] of Object.entries(telemetryMetricConfigs)) {
    for (const [sortOrder, config] of configs.entries()) {
      const createdConfig = await prisma.telemetryMetricConfig.create({
        data: {
          deviceCode,
          key: config.key,
          label: config.label,
          baseValue: config.baseValue,
          max: config.max,
          min: config.min,
          precision: config.precision,
          speed: config.speed,
          unit: config.unit ?? null,
          alarmSuggestion: config.alarmSuggestion ?? null,
          alarmText: config.alarmText ?? null,
          warningText: config.warningText ?? null,
          sortOrder
        }
      })

      const thresholds = [
        ...(config.thresholds?.high?.alarm !== undefined
          ? [{ direction: 'high', level: 'alarm', value: config.thresholds.high.alarm }]
          : []),
        ...(config.thresholds?.high?.warning !== undefined
          ? [{ direction: 'high', level: 'warning', value: config.thresholds.high.warning }]
          : []),
        ...(config.thresholds?.low?.alarm !== undefined
          ? [{ direction: 'low', level: 'alarm', value: config.thresholds.low.alarm }]
          : []),
        ...(config.thresholds?.low?.warning !== undefined
          ? [{ direction: 'low', level: 'warning', value: config.thresholds.low.warning }]
          : []),
      ]

      if (thresholds.length > 0) {
        await prisma.telemetryMetricThreshold.createMany({
          data: thresholds.map((threshold) => ({
            telemetryMetricConfigId: createdConfig.id,
            direction: threshold.direction,
            level: threshold.level,
            value: threshold.value
          }))
        })
      }
    }
  }
}

async function main() {
  await seedDevices()
  await seedWorkshopMeta()
  await seedTelemetryConfigs()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
