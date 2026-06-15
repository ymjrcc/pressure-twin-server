import { prisma } from '../db/prisma.js'
import type { ReportParseContext } from '../types/ai.js'
import type {
  CreateInspectionReportInput,
  InspectionReportDetail,
  InspectionReportDeviceDetail,
  InspectionReportDeviceRecordInput,
  InspectionReportListItem,
  InspectionReportItemResultInput,
} from '../types/inspection.js'
import type { DeviceCode } from '../types/workshop.js'

class InspectionValidationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'InspectionValidationError'
    this.statusCode = statusCode
  }
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isValidResult(result: string) {
  return result === 'normal' || result === 'abnormal'
}

function assertValidRecordShape(record: InspectionReportDeviceRecordInput) {
  if (!record.deviceCode) {
    throw new InspectionValidationError('deviceCode is required')
  }

  if (!Array.isArray(record.itemResults) || record.itemResults.length === 0) {
    throw new InspectionValidationError(`Device ${record.deviceCode} must include itemResults`)
  }

  if (typeof record.note !== 'string') {
    throw new InspectionValidationError(`Device ${record.deviceCode} note must be a string`)
  }

  if (record.checkedAt !== undefined && !isValidTimestamp(record.checkedAt)) {
    throw new InspectionValidationError(`Device ${record.deviceCode} checkedAt is invalid`)
  }

  for (const itemResult of record.itemResults) {
    assertValidItemResultShape(record.deviceCode, itemResult)
  }
}

function assertValidItemResultShape(deviceCode: string, itemResult: InspectionReportItemResultInput) {
  if (!itemResult.itemId) {
    throw new InspectionValidationError(`Device ${deviceCode} contains an empty itemId`)
  }

  if (!isValidResult(itemResult.result)) {
    throw new InspectionValidationError(`Device ${deviceCode} item ${itemResult.itemId} has an invalid result`)
  }
}

export async function createInspectionReport(input: CreateInspectionReportInput) {
  if (!isValidTimestamp(input.startedAt) || !isValidTimestamp(input.completedAt)) {
    throw new InspectionValidationError('startedAt and completedAt are required')
  }

  if (input.completedAt < input.startedAt) {
    throw new InspectionValidationError('completedAt must be greater than or equal to startedAt')
  }

  if (!Array.isArray(input.records) || input.records.length === 0) {
    throw new InspectionValidationError('records are required')
  }

  input.records.forEach(assertValidRecordShape)

  const deviceCodes = input.records.map((record) => record.deviceCode)
  const uniqueDeviceCodes = new Set<DeviceCode>(deviceCodes)

  if (uniqueDeviceCodes.size !== deviceCodes.length) {
    throw new InspectionValidationError('records contain duplicate deviceCode values')
  }

  const [devices, checklistItems] = await Promise.all([
    prisma.device.findMany({
      select: {
        code: true
      }
    }),
    prisma.inspectionChecklistItem.findMany({
      orderBy: [
        { deviceCode: 'asc' },
        { sortOrder: 'asc' }
      ],
      select: {
        deviceCode: true,
        itemId: true,
        sortOrder: true
      }
    })
  ])

  const existingDeviceCodes = new Set(devices.map((device) => device.code))

  for (const deviceCode of uniqueDeviceCodes) {
    if (!existingDeviceCodes.has(deviceCode)) {
      throw new InspectionValidationError(`Device ${deviceCode} does not exist`)
    }
  }

  const checklistMap = checklistItems.reduce((result, item) => {
    const deviceChecklist = result.get(item.deviceCode) ?? new Map<string, number>()
    deviceChecklist.set(item.itemId, item.sortOrder)
    result.set(item.deviceCode, deviceChecklist)
    return result
  }, new Map<string, Map<string, number>>())

  const requiredDeviceCodes = Array.from(checklistMap.keys()) as DeviceCode[]

  if (input.records.length !== requiredDeviceCodes.length) {
    throw new InspectionValidationError('records must cover all inspection devices')
  }

  for (const deviceCode of requiredDeviceCodes) {
    if (!uniqueDeviceCodes.has(deviceCode)) {
      throw new InspectionValidationError(`Device ${deviceCode} is missing from the report`)
    }
  }

  let normalItemCount = 0
  let abnormalItemCount = 0

  const validatedRecords = input.records.map((record) => {
    const deviceChecklist = checklistMap.get(record.deviceCode)

    if (!deviceChecklist || deviceChecklist.size === 0) {
      throw new InspectionValidationError(`Device ${record.deviceCode} has no checklist configuration`)
    }

    if (record.itemResults.length !== deviceChecklist.size) {
      throw new InspectionValidationError(`Device ${record.deviceCode} has missing inspection items`)
    }

    const seenItemIds = new Set<string>()
    const validatedItemResults = record.itemResults.map((itemResult) => {
      const expectedSortOrder = deviceChecklist.get(itemResult.itemId)

      if (expectedSortOrder === undefined) {
        throw new InspectionValidationError(`Device ${record.deviceCode} item ${itemResult.itemId} does not belong to the checklist`)
      }

      if (seenItemIds.has(itemResult.itemId)) {
        throw new InspectionValidationError(`Device ${record.deviceCode} item ${itemResult.itemId} is duplicated`)
      }

      seenItemIds.add(itemResult.itemId)

      if (itemResult.result === 'normal') {
        normalItemCount += 1
      } else {
        abnormalItemCount += 1
      }

      return {
        itemId: itemResult.itemId,
        result: itemResult.result,
        sortOrder: expectedSortOrder
      }
    })

    for (const expectedItemId of deviceChecklist.keys()) {
      if (!seenItemIds.has(expectedItemId)) {
        throw new InspectionValidationError(`Device ${record.deviceCode} is missing checklist item ${expectedItemId}`)
      }
    }

    return {
      abnormalItemCount: validatedItemResults.filter((itemResult) => itemResult.result === 'abnormal').length,
      checkedAt: record.checkedAt ? new Date(record.checkedAt) : null,
      deviceCode: record.deviceCode,
      itemResults: validatedItemResults.sort((left, right) => left.sortOrder - right.sortOrder),
      note: record.note
    }
  })

  const report = await prisma.$transaction(async (tx) => {
    const createdReport = await tx.inspectionReport.create({
      data: {
        abnormalItemCount,
        completedAt: new Date(input.completedAt),
        deviceCount: validatedRecords.length,
        normalItemCount,
        startedAt: new Date(input.startedAt),
        submittedAt: new Date()
      }
    })

    for (const [recordIndex, record] of validatedRecords.entries()) {
      const createdRecord = await tx.inspectionReportDeviceRecord.create({
        data: {
          abnormalItemCount: record.abnormalItemCount,
          checkedAt: record.checkedAt,
          deviceCode: record.deviceCode,
          note: record.note,
          reportId: createdReport.id,
          sortOrder: recordIndex
        }
      })

      await tx.inspectionReportItemResult.createMany({
        data: record.itemResults.map((itemResult) => ({
          deviceRecordId: createdRecord.id,
          itemId: itemResult.itemId,
          result: itemResult.result,
          sortOrder: itemResult.sortOrder
        }))
      })
    }

    return createdReport
  })

  return {
    reportId: report.id
  }
}

function toTimestamp(date: Date | null | undefined) {
  return date ? date.getTime() : undefined
}

function mapReportSummary(report: {
  abnormalItemCount: number
  completedAt: Date
  deviceCount: number
  id: number
  normalItemCount: number
  startedAt: Date
  submittedAt: Date
}): InspectionReportListItem {
  return {
    abnormalItemCount: report.abnormalItemCount,
    completedAt: report.completedAt.getTime(),
    deviceCount: report.deviceCount,
    id: report.id,
    normalItemCount: report.normalItemCount,
    startedAt: report.startedAt.getTime(),
    submittedAt: report.submittedAt.getTime(),
  }
}

export async function listInspectionReports(): Promise<InspectionReportListItem[]> {
  const reports = await prisma.inspectionReport.findMany({
    orderBy: {
      submittedAt: 'desc',
    },
  })

  return reports.map(mapReportSummary)
}

export async function getInspectionReportDetail(reportId: number): Promise<InspectionReportDetail | null> {
  const report = await prisma.inspectionReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      deviceRecords: {
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          itemResults: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      },
    },
  })

  if (!report) {
    return null
  }

  const [devices, checklistItems] = await Promise.all([
    prisma.device.findMany({
      select: {
        code: true,
        name: true,
      },
    }),
    prisma.inspectionChecklistItem.findMany({
      select: {
        deviceCode: true,
        itemId: true,
        label: true,
      },
    }),
  ])

  const deviceNameMap = new Map(devices.map((device) => [device.code, device.name]))
  const checklistLabelMap = new Map(
    checklistItems.map((item) => [`${item.deviceCode}:${item.itemId}`, item.label]),
  )

  const deviceRecords: InspectionReportDeviceDetail[] = report.deviceRecords.map((deviceRecord) => {
    const mappedRecord: InspectionReportDeviceDetail = {
      abnormalItemCount: deviceRecord.abnormalItemCount,
      deviceCode: deviceRecord.deviceCode as DeviceCode,
      deviceName: deviceNameMap.get(deviceRecord.deviceCode) ?? deviceRecord.deviceCode,
      itemResults: deviceRecord.itemResults.map((itemResult) => ({
        itemId: itemResult.itemId,
        label: checklistLabelMap.get(`${deviceRecord.deviceCode}:${itemResult.itemId}`) ?? itemResult.itemId,
        result: itemResult.result as InspectionReportItemResultInput['result'],
        sortOrder: itemResult.sortOrder,
      })),
      note: deviceRecord.note,
      sortOrder: deviceRecord.sortOrder,
    }

    const checkedAt = toTimestamp(deviceRecord.checkedAt)

    if (checkedAt !== undefined) {
      mappedRecord.checkedAt = checkedAt
    }

    return mappedRecord
  })

  return {
    ...mapReportSummary(report),
    deviceRecords,
  }
}

export async function buildInspectionReportParseContext(reportId: number): Promise<ReportParseContext | null> {
  const report = await getInspectionReportDetail(reportId)

  if (!report) {
    return null
  }

  const devices = await prisma.device.findMany({
    include: {
      parameters: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  })

  const deviceMap = new Map(devices.map((device) => [device.code, device]))

  return {
    report: {
      id: report.id,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      submittedAt: report.submittedAt,
      deviceCount: report.deviceCount,
      normalItemCount: report.normalItemCount,
      abnormalItemCount: report.abnormalItemCount,
    },
    devices: report.deviceRecords.map((deviceRecord) => {
      const device = deviceMap.get(deviceRecord.deviceCode)

      return {
        deviceCode: deviceRecord.deviceCode,
        deviceName: deviceRecord.deviceName,
        description: device?.description ?? '',
        parameters:
          device?.parameters.map((parameter) => ({
            label: parameter.label,
            value: parameter.value,
            ...(parameter.unit ? { unit: parameter.unit } : {}),
            ...(parameter.status ? { status: parameter.status } : {}),
          })) ?? [],
        ...(deviceRecord.checkedAt !== undefined ? { checkedAt: deviceRecord.checkedAt } : {}),
        abnormalItemCount: deviceRecord.abnormalItemCount,
        note: deviceRecord.note,
        inspectionItems: deviceRecord.itemResults.map((itemResult) => ({
          itemId: itemResult.itemId,
          label: itemResult.label,
          result: itemResult.result,
        })),
      }
    }),
  }
}

export function isInspectionValidationError(error: unknown): error is InspectionValidationError {
  return error instanceof InspectionValidationError
}
