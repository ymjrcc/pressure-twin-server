import type { DeviceCode, DeviceStatus } from './workshopDevices.ts'

export type TelemetryParameter = {
  alarmDurationMs?: number
  alarmStartedAt?: number
  alarmSuggestion?: string
  key: string
  label: string
  max: string
  min: string
  normalizedRatio: number
  rawValue: number
  status: DeviceStatus
  unit?: string
  updatedAt: number
  value: string
}

export type DeviceTelemetry = {
  parameters: TelemetryParameter[]
  status: DeviceStatus
  updatedAt: number
}

export type DeviceTelemetrySnapshot = Record<DeviceCode, DeviceTelemetry>

export type TelemetryOverrideStatus = Exclude<DeviceStatus, 'normal'>

export type DeviceTelemetryOverride = {
  device?: TelemetryOverrideStatus
  parameters?: Record<string, TelemetryOverrideStatus>
}

export type DeviceTelemetryOverrides = Partial<Record<DeviceCode, DeviceTelemetryOverride>>

export type TelemetryAlarmStartedAtByParameter = Record<string, number>

export type TelemetryThreshold = {
  alarm?: number
  warning?: number
}

export type TelemetryMetricConfig = {
  alarmSuggestion?: string
  alarmText?: string
  baseValue: number
  key: string
  label: string
  max: number
  min: number
  precision: number
  speed: number
  unit?: string
  warningText?: string
  thresholds?: {
    high?: TelemetryThreshold
    low?: TelemetryThreshold
  }
}

export type TelemetryMetricState = {
  direction: number
  phase: number
  value: number
}

export type DeviceTelemetryRuntime = Record<DeviceCode, Record<string, TelemetryMetricState>>

const statusPriority: Record<DeviceStatus, number> = {
  offline: 3,
  alarm: 2,
  warning: 1,
  normal: 0,
}

const fallbackAlarmSuggestion = '请立即核对现场仪表状态，必要时降低负荷并通知值班人员处置。'

export function getTelemetryAlarmKey(deviceCode: DeviceCode, parameterKey: string) {
  return `${deviceCode}:${parameterKey}`
}

export const telemetryMetricConfigs: Record<DeviceCode, TelemetryMetricConfig[]> = {
  'T-201': [
    {
      alarmSuggestion: '检查进出料阀位与液位联锁，必要时切换至手动补排液控制。',
      baseValue: 68,
      key: 'level',
      label: '液位',
      max: 82,
      min: 52,
      precision: 0,
      speed: 1.7,
      thresholds: { high: { alarm: 80, warning: 76 }, low: { alarm: 48, warning: 52 } },
      unit: '%',
    },
    {
      alarmSuggestion: '核对压力变送器与安全阀状态，必要时降低进料压力并泄压。',
      baseValue: 0.42,
      key: 'pressure',
      label: '罐内压力',
      max: 0.52,
      min: 0.34,
      precision: 2,
      speed: 0.018,
      thresholds: { high: { alarm: 0.58, warning: 0.5 }, low: { warning: 0.32 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查换热介质流量与温控阀开度，必要时降低储罐热负荷。',
      baseValue: 38.6,
      key: 'temperature',
      label: '介质温度',
      max: 43.5,
      min: 34.2,
      precision: 1,
      speed: 0.45,
      thresholds: { high: { alarm: 48, warning: 43 } },
      unit: '℃',
    },
  ],
  'PU-101': [
    {
      alarmSuggestion: '检查泵出口阀位、旁路与联锁状态，必要时降低泵频率。',
      baseValue: 0.78,
      key: 'outletPressure',
      label: '出口压力',
      max: 0.9,
      min: 0.66,
      precision: 2,
      speed: 0.028,
      thresholds: { high: { alarm: 0.96, warning: 0.88 }, low: { alarm: 0.58, warning: 0.64 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查入口过滤器和管线阀位，确认无堵塞或汽蚀风险。',
      baseValue: 42.5,
      key: 'flow',
      label: '流量',
      max: 49,
      min: 35,
      precision: 1,
      speed: 1.15,
      thresholds: { high: { warning: 48 }, low: { alarm: 30, warning: 35 } },
      unit: 'm3/h',
    },
    {
      alarmSuggestion: '检查轴承润滑与冷却状态，必要时切换备用泵。',
      baseValue: 54.2,
      key: 'bearingTemperature',
      label: '轴承温度',
      max: 63,
      min: 48,
      precision: 1,
      speed: 0.85,
      thresholds: { high: { alarm: 72, warning: 62 } },
      unit: '℃',
    },
    {
      alarmSuggestion: '检查泵体基础、联轴器和轴承状态，必要时停泵检修。',
      baseValue: 1.8,
      key: 'vibration',
      label: '振动',
      max: 2.8,
      min: 1.1,
      precision: 1,
      speed: 0.22,
      thresholds: { high: { alarm: 4.5, warning: 2.6 } },
      unit: 'mm/s',
    },
  ],
  'E-101': [
    {
      alarmSuggestion: '检查热源侧调节阀和入口温控回路，必要时降低热负荷。',
      baseValue: 92.4,
      key: 'inletTemperature',
      label: '入口温度',
      max: 96.5,
      min: 87.8,
      precision: 1,
      speed: 0.8,
      thresholds: { high: { alarm: 100, warning: 95 } },
      unit: '℃',
    },
    {
      alarmSuggestion: '核对出口温度趋势与冷却介质流量，必要时调整换热负荷。',
      baseValue: 73.8,
      key: 'outletTemperature',
      label: '出口温度',
      max: 78.8,
      min: 68.5,
      precision: 1,
      speed: 0.72,
      thresholds: { high: { alarm: 82, warning: 76 } },
      unit: '℃',
    },
    {
      alarmSuggestion: '检查壳程压力控制阀与排凝状态，必要时旁路降压。',
      baseValue: 0.64,
      key: 'shellPressure',
      label: '壳程压力',
      max: 0.74,
      min: 0.56,
      precision: 2,
      speed: 0.02,
      thresholds: { high: { alarm: 0.84, warning: 0.72 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查管程入口压力与堵塞风险，必要时切换旁路或降流量。',
      baseValue: 0.58,
      key: 'tubePressure',
      label: '管程压力',
      max: 0.68,
      min: 0.5,
      precision: 2,
      speed: 0.018,
      thresholds: { high: { alarm: 0.78, warning: 0.66 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查换热器结垢、流量分配和温差，安排清洗或降负荷运行。',
      baseValue: 82,
      key: 'efficiency',
      label: '换热效率',
      max: 88,
      min: 76,
      precision: 0,
      speed: 0.9,
      thresholds: { low: { alarm: 72, warning: 80 } },
      unit: '%',
    },
  ],
  'V-101': [
    {
      alarmSuggestion: '核对压力表和变送器读数，检查安全阀前后阀位并准备泄压。',
      baseValue: 0.86,
      key: 'workingPressure',
      label: '工作压力',
      max: 1,
      min: 0.72,
      precision: 2,
      speed: 0.026,
      thresholds: { high: { alarm: 1.26, warning: 0.98 }, low: { warning: 0.7 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查容器伴热、冷却与介质循环状态，必要时降低工艺温度。',
      baseValue: 46.3,
      key: 'workingTemperature',
      label: '工作温度',
      max: 51.5,
      min: 41.2,
      precision: 1,
      speed: 0.58,
      thresholds: { high: { alarm: 60, warning: 51 } },
      unit: '℃',
    },
  ],
  'V-102': [
    {
      alarmSuggestion: '核对压力表和变送器读数，检查安全阀前后阀位并准备泄压。',
      baseValue: 0.82,
      key: 'workingPressure',
      label: '工作压力',
      max: 0.97,
      min: 0.7,
      precision: 2,
      speed: 0.024,
      thresholds: { high: { alarm: 1.22, warning: 0.95 }, low: { warning: 0.68 } },
      unit: 'MPa',
    },
    {
      alarmSuggestion: '检查容器伴热、冷却与介质循环状态，必要时降低工艺温度。',
      baseValue: 44.9,
      key: 'workingTemperature',
      label: '工作温度',
      max: 50.5,
      min: 40.5,
      precision: 1,
      speed: 0.54,
      thresholds: { high: { alarm: 58, warning: 50 } },
      unit: '℃',
    },
  ],
  'CC-101': [
    {
      alarmSuggestion: '检查柜内空调、风扇和门封状态，必要时切换备用散热。',
      baseValue: 31.5,
      key: 'cabinetTemperature',
      label: '柜内温度',
      max: 38,
      min: 27,
      precision: 1,
      speed: 0.52,
      thresholds: { high: { alarm: 45, warning: 38 } },
      unit: '℃',
    },
    {
      alarmSuggestion: '检查控制程序负载与通讯任务，必要时切换控制器或降采样频率。',
      baseValue: 36,
      key: 'plcLoad',
      label: 'PLC 负载',
      max: 58,
      min: 24,
      precision: 0,
      speed: 2.8,
      thresholds: { high: { alarm: 86, warning: 70 } },
      unit: '%',
    },
    {
      alarmSuggestion: '检查交换机端口、网线和上位机链路，必要时切换冗余网络。',
      baseValue: 18,
      key: 'networkLatency',
      label: '网络延迟',
      max: 36,
      min: 10,
      precision: 0,
      speed: 3.4,
      thresholds: { high: { alarm: 120, warning: 60 } },
      unit: 'ms',
    },
  ],
}

export function createInitialTelemetryRuntime(): DeviceTelemetryRuntime {
  return Object.fromEntries(
    Object.entries(telemetryMetricConfigs).map(([deviceCode, configs], deviceIndex) => [
      deviceCode,
      Object.fromEntries(
        configs.map((config, metricIndex) => [
          config.key,
          {
            direction: metricIndex % 2 === 0 ? 1 : -1,
            phase: (deviceIndex + 1) * 0.9 + metricIndex * 0.65,
            value: config.baseValue,
          },
        ]),
      ),
    ]),
  ) as DeviceTelemetryRuntime
}

export function createTelemetrySnapshot(
  runtime: DeviceTelemetryRuntime,
  overrides: DeviceTelemetryOverrides = {},
  updatedAt = Date.now(),
  alarmStartedAtByParameter: TelemetryAlarmStartedAtByParameter = {},
): DeviceTelemetrySnapshot {
  return Object.fromEntries(
    Object.entries(telemetryMetricConfigs).map(([deviceCode, configs]) => {
      const override = overrides[deviceCode as DeviceCode]
      const deviceParameters = configs.map((config) => {
        const metric = runtime[deviceCode as DeviceCode][config.key]
        const value = metric?.value ?? config.baseValue
        const overrideStatus = override?.parameters?.[config.key] ?? override?.device
        const displayValue = overrideStatus ? getOverrideMetricValue(config, overrideStatus) : value
        const status = overrideStatus ?? getMetricStatus(value, config)
        const alarmStartedAt = alarmStartedAtByParameter[getTelemetryAlarmKey(deviceCode as DeviceCode, config.key)]

        return {
          ...(status === 'alarm' && alarmStartedAt !== undefined
            ? {
                alarmDurationMs: Math.max(0, updatedAt - alarmStartedAt),
                alarmStartedAt,
                alarmSuggestion: config.alarmSuggestion ?? fallbackAlarmSuggestion,
              }
            : {}),
          key: config.key,
          label: config.label,
          max: formatMetricValue(config.max, config.precision),
          min: formatMetricValue(config.min, config.precision),
          normalizedRatio: getNormalizedRatio(displayValue, config.min, config.max),
          rawValue: displayValue,
          status,
          unit: config.unit,
          updatedAt,
          value: overrideStatus === 'offline' ? '离线' : formatMetricValue(displayValue, config.precision),
        }
      })
      const status = deviceParameters.reduce<DeviceStatus>(
        (currentStatus, parameter) =>
          statusPriority[parameter.status] > statusPriority[currentStatus] ? parameter.status : currentStatus,
        'normal',
      )

      return [
        deviceCode,
        {
          parameters: deviceParameters,
          status,
          updatedAt,
        },
      ]
    }),
  ) as DeviceTelemetrySnapshot
}

export function advanceTelemetryRuntime(runtime: DeviceTelemetryRuntime): DeviceTelemetryRuntime {
  return Object.fromEntries(
    Object.entries(telemetryMetricConfigs).map(([deviceCode, configs]) => [
      deviceCode,
      Object.fromEntries(
        configs.map((config) => {
          const currentMetric = runtime[deviceCode as DeviceCode][config.key]
          const nextPhase = currentMetric.phase + 0.5
          const wave = Math.sin(nextPhase) * config.speed * 0.48
          const drift = currentMetric.direction * config.speed * 0.52
          let nextDirection = currentMetric.direction
          let nextValue = currentMetric.value + wave + drift

          if (nextValue >= config.max) {
            nextValue = config.max
            nextDirection = -1
          }

          if (nextValue <= config.min) {
            nextValue = config.min
            nextDirection = 1
          }

          return [
            config.key,
            {
              direction: nextDirection,
              phase: nextPhase,
              value: nextValue,
            },
          ]
        }),
      ),
    ]),
  ) as DeviceTelemetryRuntime
}

function getMetricStatus(value: number, config: TelemetryMetricConfig): DeviceStatus {
  const high = config.thresholds?.high
  const low = config.thresholds?.low

  if ((high?.alarm !== undefined && value >= high.alarm) || (low?.alarm !== undefined && value <= low.alarm)) {
    return 'alarm'
  }

  if ((high?.warning !== undefined && value >= high.warning) || (low?.warning !== undefined && value <= low.warning)) {
    return 'warning'
  }

  return 'normal'
}

function getOverrideMetricValue(config: TelemetryMetricConfig, status: TelemetryOverrideStatus) {
  if (status === 'offline') {
    return config.baseValue
  }

  const range = config.max - config.min
  const fallbackOffset = range > 0 ? range * 0.12 : Math.max(Math.abs(config.baseValue) * 0.12, 1)
  const threshold = getPreferredOverrideThreshold(config, status)

  if (!threshold) {
    return config.max + fallbackOffset
  }

  if (threshold.direction === 'high') {
    const nextThreshold =
      status === 'warning' && config.thresholds?.high?.alarm !== undefined ? config.thresholds.high.alarm : undefined

    return nextThreshold !== undefined
      ? threshold.value + (nextThreshold - threshold.value) * 0.45
      : threshold.value + fallbackOffset
  }

  const nextThreshold =
    status === 'warning' && config.thresholds?.low?.alarm !== undefined ? config.thresholds.low.alarm : undefined

  return nextThreshold !== undefined
    ? threshold.value - (threshold.value - nextThreshold) * 0.45
    : threshold.value - fallbackOffset
}

function getPreferredOverrideThreshold(config: TelemetryMetricConfig, status: 'warning' | 'alarm') {
  const highValue = config.thresholds?.high?.[status]
  const lowValue = config.thresholds?.low?.[status]

  if (highValue !== undefined) {
    return { direction: 'high' as const, value: highValue }
  }

  if (lowValue !== undefined) {
    return { direction: 'low' as const, value: lowValue }
  }

  const highFallback = config.thresholds?.high?.warning ?? config.thresholds?.high?.alarm
  const lowFallback = config.thresholds?.low?.warning ?? config.thresholds?.low?.alarm

  if (highFallback !== undefined) {
    return { direction: 'high' as const, value: highFallback }
  }

  if (lowFallback !== undefined) {
    return { direction: 'low' as const, value: lowFallback }
  }

  return null
}

function formatMetricValue(value: number, precision: number) {
  return value.toFixed(precision)
}

function getNormalizedRatio(value: number, min: number, max: number) {
  if (max <= min) {
    return 0
  }

  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}
