export type ReportParseContext = {
  report: {
    id: number
    startedAt: number
    completedAt: number
    submittedAt: number
    deviceCount: number
    normalItemCount: number
    abnormalItemCount: number
  }
  devices: Array<{
    deviceCode: string
    deviceName: string
    description: string
    parameters: Array<{
      label: string
      value: string
      unit?: string
      status?: string
    }>
    checkedAt?: number
    abnormalItemCount: number
    note: string
    inspectionItems: Array<{
      itemId: string
      label: string
      result: 'normal' | 'abnormal'
    }>
  }>
}
