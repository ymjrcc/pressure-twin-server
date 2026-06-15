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

export type InspectionReportListItem = {
  abnormalItemCount: number
  completedAt: number
  deviceCount: number
  id: number
  normalItemCount: number
  startedAt: number
  submittedAt: number
}

export type InspectionReportItemResultDetail = {
  itemId: string
  label: string
  result: InspectionItemResult
  sortOrder: number
}

export type InspectionReportDeviceDetail = {
  abnormalItemCount: number
  checkedAt?: number
  deviceCode: DeviceCode
  deviceName: string
  itemResults: InspectionReportItemResultDetail[]
  note: string
  sortOrder: number
}

export type InspectionReportDetail = InspectionReportListItem & {
  deviceRecords: InspectionReportDeviceDetail[]
}
