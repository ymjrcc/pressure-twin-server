import type { Device, DeviceParameter } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import type { DeviceInfo, DeviceStatus, DeviceThumbnailType, StaticDeviceParameter } from '../../workshopDevices.js'

type DeviceWithParameters = Device & {
  parameters: DeviceParameter[]
}

function mapParameter(parameter: DeviceParameter): StaticDeviceParameter {
  return {
    label: parameter.label,
    value: parameter.value,
    ...(parameter.unit ? { unit: parameter.unit } : {}),
    ...(parameter.status ? { status: parameter.status as DeviceStatus } : {})
  }
}

function mapDevice(device: DeviceWithParameters): DeviceInfo {
  return {
    code: device.code as DeviceInfo['code'],
    description: device.description,
    haloPosition: [device.haloPositionX, device.haloPositionY, device.haloPositionZ],
    haloRadius: device.haloRadius,
    name: device.name,
    parameters: device.parameters.map(mapParameter),
    position: [device.positionX, device.positionY, device.positionZ],
    status: device.status as DeviceStatus,
    thumbnailType: device.thumbnailType as DeviceThumbnailType
  }
}

const deviceInclude = {
  parameters: {
    orderBy: {
      sortOrder: 'asc'
    }
  }
} as const

export async function listDevices(): Promise<DeviceInfo[]> {
  const devices = await prisma.device.findMany({
    include: deviceInclude,
    orderBy: {
      sortOrder: 'asc'
    }
  })

  return devices.map(mapDevice)
}

export async function getDeviceByCode(code: string): Promise<DeviceInfo | null> {
  const device = await prisma.device.findUnique({
    where: {
      code
    },
    include: deviceInclude
  })

  return device ? mapDevice(device) : null
}
