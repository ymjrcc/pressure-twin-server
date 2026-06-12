import type { DeviceCode, DeviceStatus } from './workshop.js'

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
