import { prisma } from '../db/prisma.js'
import type { TelemetryMetricConfig, TelemetryThreshold } from '../types/telemetry.js'
import type { DeviceCode, DeviceStatus, InspectionItem, InstrumentInfo, ProcessFlowStep } from '../types/workshop.js'

export async function getInspectionChecklists(): Promise<Record<DeviceCode, InspectionItem[]>> {
  const items = await prisma.inspectionChecklistItem.findMany({
    orderBy: [
      { deviceCode: 'asc' },
      { sortOrder: 'asc' }
    ]
  })

  return items.reduce((result, item) => {
    const deviceCode = item.deviceCode as DeviceCode
    const checklist = result[deviceCode] ?? []

    checklist.push({
      id: item.itemId,
      label: item.label,
      description: item.description
    })

    result[deviceCode] = checklist
    return result
  }, {} as Record<DeviceCode, InspectionItem[]>)
}

export async function getInstruments(): Promise<InstrumentInfo[]> {
  const instruments = await prisma.instrument.findMany({
    orderBy: {
      sortOrder: 'asc'
    }
  })

  return instruments.map((instrument) => ({
    code: instrument.code,
    name: instrument.name
  }))
}

export async function getProcessFlowSteps(): Promise<ProcessFlowStep[]> {
  const steps = await prisma.processFlowStep.findMany({
    orderBy: {
      sortOrder: 'asc'
    }
  })

  return steps.map((step) => {
    const mappedStep: ProcessFlowStep = {
      code: step.code,
      description: step.description,
      deviceName: step.deviceName,
      title: step.title
    }

    if (step.status) {
      mappedStep.status = step.status as DeviceStatus
    }

    if (step.variant === 'control' || step.variant === 'return') {
      mappedStep.variant = step.variant
    }

    return mappedStep
  })
}

export async function getTelemetryConfigs(): Promise<Record<DeviceCode, TelemetryMetricConfig[]>> {
  const configs = await prisma.telemetryMetricConfig.findMany({
    include: {
      thresholds: {
        orderBy: [
          { direction: 'asc' },
          { level: 'asc' }
        ]
      }
    },
    orderBy: [
      { deviceCode: 'asc' },
      { sortOrder: 'asc' }
    ]
  })

  return configs.reduce((result, config) => {
    const deviceCode = config.deviceCode as DeviceCode
    const deviceConfigs = result[deviceCode] ?? []
    const mappedThresholds = mapThresholds(config.thresholds)
    const mappedConfig: TelemetryMetricConfig = {
      baseValue: config.baseValue,
      key: config.key,
      label: config.label,
      max: config.max,
      min: config.min,
      precision: config.precision,
      speed: config.speed
    }

    if (config.alarmSuggestion) {
      mappedConfig.alarmSuggestion = config.alarmSuggestion
    }

    if (config.alarmText) {
      mappedConfig.alarmText = config.alarmText
    }

    if (config.unit) {
      mappedConfig.unit = config.unit
    }

    if (config.warningText) {
      mappedConfig.warningText = config.warningText
    }

    if (mappedThresholds) {
      mappedConfig.thresholds = mappedThresholds
    }

    deviceConfigs.push(mappedConfig)

    result[deviceCode] = deviceConfigs
    return result
  }, {} as Record<DeviceCode, TelemetryMetricConfig[]>)
}

function mapThresholds(
  thresholds: Array<{ direction: string; level: string; value: number }>
): TelemetryMetricConfig['thresholds'] | undefined {
  if (thresholds.length === 0) {
    return undefined
  }

  const mapped: NonNullable<TelemetryMetricConfig['thresholds']> = {}

  for (const threshold of thresholds) {
    const direction = threshold.direction as keyof NonNullable<TelemetryMetricConfig['thresholds']>
    const level = threshold.level as keyof TelemetryThreshold
    const currentDirection = mapped[direction] ?? {}

    currentDirection[level] = threshold.value
    mapped[direction] = currentDirection
  }

  return mapped
}
