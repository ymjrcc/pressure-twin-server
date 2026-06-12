import type { DeviceCode, InspectionItemResult } from './workshop.js'

export type InspectionReportItemResultInput = {
  itemId: string
  result: InspectionItemResult
}

export type InspectionReportDeviceRecordInput = {
  checkedAt?: number
  deviceCode: DeviceCode
  itemResults: InspectionReportItemResultInput[]
  note: string
}

export type CreateInspectionReportInput = {
  completedAt: number
  records: InspectionReportDeviceRecordInput[]
  startedAt: number
}
