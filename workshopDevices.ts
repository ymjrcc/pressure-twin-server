export type DeviceCode = 'T-201' | 'PU-101' | 'E-101' | 'V-101' | 'V-102' | 'CC-101'

export type DeviceStatus = 'normal' | 'warning' | 'alarm' | 'offline'

export type DeviceThumbnailType = 'tank' | 'pump' | 'exchanger' | 'vessel' | 'cabinet'

export type InspectionItemResult = 'normal' | 'abnormal'

export type InspectionItem = {
  description: string
  id: string
  label: string
}

export type DeviceInspectionRecord = {
  checkedAt?: number
  deviceCode: DeviceCode
  itemResults: Record<string, InspectionItemResult | undefined>
  note: string
}

export type InspectionSession = {
  completedAt?: number
  currentDeviceIndex: number
  records: Record<DeviceCode, DeviceInspectionRecord>
  startedAt: number
  status: 'idle' | 'running' | 'completed'
}

export type StaticDeviceParameter = {
  label: string
  status?: DeviceStatus
  unit?: string
  value: string
}

export type DeviceInfo = {
  code: DeviceCode
  description: string
  haloPosition: [number, number, number]
  haloRadius: number
  name: string
  parameters: StaticDeviceParameter[]
  position: [number, number, number]
  status: DeviceStatus
  thumbnailType: DeviceThumbnailType
}

export type InstrumentInfo = {
  code: string
  name: string
}

export type ProcessFlowStep = {
  code: string
  description: string
  deviceName: string
  status?: DeviceStatus
  title: string
  variant?: 'control' | 'return'
}

export const devices: DeviceInfo[] = [
  {
    code: 'T-201',
    description: '储存循环介质并配置液位、压力监测的立式承压储罐。',
    haloPosition: [5.2, 0.035, 2.3],
    haloRadius: 1.5,
    name: '立式储罐',
    parameters: [
      { label: '设计压力', unit: 'MPa', value: '1.60' },
      { label: '下次检验', value: '2026-11-18' },
    ],
    position: [6.25, 4.55, 2.45],
    status: 'normal',
    thumbnailType: 'tank',
  },
  {
    code: 'PU-101',
    description: '为闭路循环提供动力的离心泵，联锁监测出口压力与电机负载。',
    haloPosition: [1.6, 0.035, 1.8],
    haloRadius: 1.15,
    name: '循环泵',
    parameters: [
      { label: '电机功率', unit: 'kW', value: '18.5' },
      { label: '驱动方式', value: '变频控制' },
    ],
    position: [1.55, 1.72, 2.45],
    status: 'normal',
    thumbnailType: 'pump',
  },
  {
    code: 'E-101',
    description: '管壳式换热器，用于循环介质热量交换并监测进出口压力温度。',
    haloPosition: [-3.4, 0.035, 1.5],
    haloRadius: 2.15,
    name: '换热器',
    parameters: [
      { label: '换热面积', unit: 'm2', value: '35' },
      { label: '流程形式', value: '管壳式' },
    ],
    position: [-3.45, 2.12, 2.15],
    status: 'warning',
    thumbnailType: 'exchanger',
  },
  {
    code: 'V-101',
    description: '第一台卧式压力容器，配置压力表、变送器和安全阀。',
    haloPosition: [-4.2, 0.035, -3.2],
    haloRadius: 3.35,
    name: '卧式压力容器',
    parameters: [
      { label: '设计压力', unit: 'MPa', value: '2.50' },
      { label: '容积', unit: 'm3', value: '12.0' },
      { label: '下次检验', value: '2026-09-30' },
    ],
    position: [-4.35, 3.62, -2.05],
    status: 'normal',
    thumbnailType: 'vessel',
  },
  {
    code: 'V-102',
    description: '第二台卧式压力容器，与 V-101 并联参与工艺缓冲与压力监测。',
    haloPosition: [2.6, 0.035, -3.2],
    haloRadius: 3.35,
    name: '卧式压力容器',
    parameters: [
      { label: '设计压力', unit: 'MPa', value: '2.50' },
      { label: '容积', unit: 'm3', value: '12.0' },
      { label: '下次检验', value: '2026-10-15' },
    ],
    position: [2.8, 3.62, -2.05],
    status: 'normal',
    thumbnailType: 'vessel',
  },
  {
    code: 'CC-101',
    description: '现场控制柜，汇集压力、液位、温度等仪表信号并执行联锁控制。',
    haloPosition: [-0.9, 0.035, 5.55],
    haloRadius: 0.8,
    name: '控制柜',
    parameters: [
      { label: '采集点位', unit: '点', value: '18' },
      { label: '供电状态', status: 'normal', value: '双路正常' },
    ],
    position: [-0.9, 2.65, 6],
    status: 'normal',
    thumbnailType: 'cabinet',
  },
]

export const inspectionChecklists: Record<DeviceCode, InspectionItem[]> = {
  'T-201': [
    { description: '确认液位计、液位变送器读数稳定且无卡滞。', id: 'level', label: '液位状态' },
    { description: '核对罐内压力表和变送器读数，无超限趋势。', id: 'pressure', label: '压力监测' },
    { description: '检查进出口阀门开度、手轮和阀杆状态。', id: 'valves', label: '阀门状态' },
    { description: '检查罐体、管口、法兰和底部区域无渗漏。', id: 'leakage', label: '泄漏检查' },
    { description: '确认液位、压力联锁与现场报警指示正常。', id: 'interlock', label: '联锁报警' },
  ],
  'PU-101': [
    { description: '核对出口压力与控制系统读数，无异常波动。', id: 'outletPressure', label: '出口压力' },
    { description: '听诊泵体运行声音，确认振动趋势在正常范围。', id: 'vibration', label: '振动噪声' },
    { description: '检查轴承温度、润滑和冷却状态。', id: 'bearing', label: '轴承温度' },
    { description: '检查机械密封、泵壳和法兰连接处无渗漏。', id: 'sealLeakage', label: '密封泄漏' },
    { description: '确认电机电流、接地和变频运行状态正常。', id: 'motor', label: '电机状态' },
  ],
  'E-101': [
    { description: '核对进出口温度差，确认换热负荷无异常突变。', id: 'temperature', label: '进出口温度' },
    { description: '检查壳程压力读数和调节阀状态。', id: 'shellPressure', label: '壳程压力' },
    { description: '检查管程压力读数，关注堵塞或压差升高迹象。', id: 'tubePressure', label: '管程压力' },
    { description: '检查管箱、法兰、排凝点和壳体无渗漏。', id: 'leakage', label: '泄漏检查' },
    { description: '检查保温层、支座和外表面，无结垢或异常发热点迹象。', id: 'insulation', label: '保温外观' },
  ],
  'V-101': [
    { description: '检查容器外观、铭牌和防腐层，无明显变形或腐蚀。', id: 'appearance', label: '外观防腐' },
    { description: '核对压力表与变送器读数，确认无超限趋势。', id: 'pressure', label: '压力仪表' },
    { description: '确认安全阀铅封、前后阀位和排放管状态。', id: 'safetyValve', label: '安全阀' },
    { description: '检查法兰、焊缝、管口和排污点无泄漏。', id: 'leakage', label: '泄漏检查' },
    { description: '检查支座、地脚螺栓和管口应力状态。', id: 'support', label: '支座管口' },
  ],
  'V-102': [
    { description: '检查容器外观、铭牌和防腐层，无明显变形或腐蚀。', id: 'appearance', label: '外观防腐' },
    { description: '核对压力表与变送器读数，确认无超限趋势。', id: 'pressure', label: '压力仪表' },
    { description: '确认安全阀铅封、前后阀位和排放管状态。', id: 'safetyValve', label: '安全阀' },
    { description: '检查法兰、焊缝、管口和排污点无泄漏。', id: 'leakage', label: '泄漏检查' },
    { description: '检查支座、地脚螺栓和管口应力状态。', id: 'support', label: '支座管口' },
  ],
  'CC-101': [
    { description: '确认双路供电、电源指示和接地状态正常。', id: 'power', label: '供电状态' },
    { description: '检查压力、液位、温度等信号采集状态，无丢点。', id: 'signals', label: '信号采集' },
    { description: '确认报警灯、蜂鸣器和面板指示动作正常。', id: 'alarmIndicator', label: '报警指示' },
    { description: '检查柜内接线端子、线槽和模块固定状态。', id: 'wiring', label: '接线端子' },
    { description: '检查柜门密封、通风散热和现场环境。', id: 'cabinet', label: '柜体环境' },
  ],
}

export const inspectionPersonTargets: Record<DeviceCode, [number, number, number]> = {
  'CC-101': [-1.8, 0, 5.3],
  'E-101': [-4.8, 0, 0.2],
  'PU-101': [0.4, 0, 2.5],
  'T-201': [3.6, 0, 3.3],
  'V-101': [-6.2, 0, -2.2],
  'V-102': [0.7, 0, -2.2],
}

export const instruments: InstrumentInfo[] = [
  { code: 'PG-101', name: '压力表' },
  { code: 'PT-101', name: '压力变送器' },
  { code: 'PSV-101', name: '安全阀' },
  { code: 'PG-102', name: '压力表' },
  { code: 'PT-102', name: '压力变送器' },
  { code: 'PSV-102', name: '安全阀' },
  { code: 'PG-103', name: '压力表' },
  { code: 'LG-201', name: '液位计' },
  { code: 'LT-201', name: '液位变送器' },
  { code: 'PG-201', name: '压力表' },
  { code: 'PT-201', name: '压力变送器' },
  { code: 'PG-202', name: '压力表' },
  { code: 'PT-202', name: '压力变送器' },
]

export const processFlowSteps: ProcessFlowStep[] = [
  {
    code: 'T-201',
    description: '储存并稳定循环介质液位与压力',
    deviceName: '立式储罐',
    status: 'normal',
    title: '储罐供液',
  },
  {
    code: 'PU-101',
    description: '提供闭路循环动力并监测出口压力',
    deviceName: '循环泵',
    status: 'normal',
    title: '循环增压',
  },
  {
    code: 'E-101',
    description: '完成热量交换，当前换热负荷偏高',
    deviceName: '换热器',
    status: 'warning',
    title: '换热调节',
  },
  {
    code: 'V-101 / V-102',
    description: '并联缓冲工艺压力，维持系统稳定',
    deviceName: '卧式压力容器组',
    status: 'normal',
    title: '压力缓冲',
  },
  {
    code: 'T-201',
    description: '介质回流储罐，形成闭路循环',
    deviceName: '立式储罐',
    status: 'normal',
    title: '回流闭环',
    variant: 'return',
  },
]
