import { createHash } from 'node:crypto'
import koffi from 'koffi'
import { percentageToRaw, validateLayout } from './validation'
import type {
  ChangePlan,
  NativeDisplay,
  DisplayMode,
  HardwareCapabilities,
  HardwarePollRequest,
  HardwareWriteRequest,
} from '@screentools/contracts'

// 所有 Win32 调用只能在独立工作进程执行，主进程不得直接导入此模块。
const user = koffi.load('user32.dll')
const dxva = koffi.load('dxva2.dll')
const sizes = user.func('long __stdcall GetDisplayConfigBufferSizes(uint32_t, void *, void *)')
const query = user.func(
  'long __stdcall QueryDisplayConfig(uint32_t, void *, void *, void *, void *, void *)',
)
const deviceInfo = user.func('long __stdcall DisplayConfigGetDeviceInfo(void *)')
const setDeviceInfo = user.func('long __stdcall DisplayConfigSetDeviceInfo(void *)')
const setConfig = user.func(
  'long __stdcall SetDisplayConfig(uint32_t, void *, uint32_t, void *, uint32_t)',
)
const enumModes = user.func(
  'int __stdcall EnumDisplaySettingsExW(str16, uint32_t, void *, uint32_t)',
)
const lastError = koffi.load('kernel32.dll').func('uint32_t __stdcall GetLastError()')

export interface CcdSnapshot {
  paths: Buffer
  modes: Buffer
  pathCount: number
  modeCount: number
  colors?: Record<string, boolean>
}
function check(code: number, operation: string): void {
  if (code !== 0) throw new Error(`${operation}失败，Windows 错误码 ${code}`)
}
function text(buffer: Buffer, start: number, bytes: number): string {
  return (
    buffer
      .subarray(start, start + bytes)
      .toString('utf16le')
      .split('\0')[0] ?? ''
  )
}
export function capture(): CcdSnapshot {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pc = Buffer.alloc(4),
      mc = Buffer.alloc(4)
    check(sizes(2, pc, mc), '读取显示缓冲区')
    if (pc.readUInt32LE() > 128 || mc.readUInt32LE() > 1024) throw new Error('显示配置数量异常')
    const paths = Buffer.alloc(pc.readUInt32LE() * 72),
      modes = Buffer.alloc(mc.readUInt32LE() * 64)
    const result = query(2, pc, paths, mc, modes, null)
    if (result === 122) continue
    check(result, '读取显示配置')
    return { paths, modes, pathCount: pc.readUInt32LE(), modeCount: mc.readUInt32LE() }
  }
  throw new Error('显示设备持续变化，请稍后重试')
}
function info(path: Buffer, target: boolean, type: number, length: number): Buffer {
  const result = Buffer.alloc(length)
  result.writeUInt32LE(type, 0)
  result.writeUInt32LE(length, 4)
  path.copy(result, 8, target ? 20 : 0, target ? 32 : 12)
  check(deviceInfo(result), '读取设备信息')
  return result
}
function records(snapshot: CcdSnapshot) {
  return Array.from({ length: snapshot.pathCount }, (_, index) => {
    const path = snapshot.paths.subarray(index * 72, (index + 1) * 72)
    const target = info(path, true, 2, 420)
    const devicePath = text(target, 164, 256)
    if (!devicePath) throw new Error('设备缺少稳定路径，暂不允许修改')
    const id = createHash('sha256').update(devicePath.toLowerCase()).digest('hex').slice(0, 32)
    const sourceIndex = path.readUInt32LE(12)
    if (sourceIndex >= snapshot.modeCount) throw new Error('设备没有活动源模式')
    const source = snapshot.modes.subarray(sourceIndex * 64, (sourceIndex + 1) * 64)
    return {
      path,
      source,
      id,
      name: text(target, 36, 128) || '显示器',
      gdi: text(info(path, false, 1, 84), 20, 64),
    }
  })
}
function getModes(gdi: string): DisplayMode[] {
  const found = new Map<string, DisplayMode>()
  for (let i = 0; i < 4096; i++) {
    const dm = Buffer.alloc(220)
    dm.writeUInt16LE(220, 68)
    if (!enumModes(gdi, i, dm, 0)) break
    const mode = {
      width: dm.readUInt32LE(172),
      height: dm.readUInt32LE(176),
      refreshRate: dm.readUInt32LE(184),
    }
    // 排除低色深、隔行扫描以及驱动返回的无效模式。
    if (
      dm.readUInt32LE(168) < 24 ||
      dm.readUInt32LE(180) & 2 ||
      !mode.width ||
      !mode.height ||
      mode.refreshRate < 2
    )
      continue
    found.set(`${mode.width}:${mode.height}:${mode.refreshRate}`, mode)
  }
  return [...found.values()].sort(
    (a, b) => b.width - a.width || b.height - a.height || b.refreshRate - a.refreshRate,
  )
}
export function enumerate(snapshot = capture()): NativeDisplay[] {
  return records(snapshot).map(({ path, source, id, name, gdi }) => {
    let hdr: NativeDisplay['hdr'] = null
    try {
      const color = info(path, true, 9, 32).readUInt32LE(20)
      hdr = { supported: !!(color & 1), enabled: !!(color & 2) }
    } catch {
      /* 驱动不支持高级颜色查询。 */
    }
    const technology = path.readUInt32LE(36)
    const rotation = ((path.readUInt32LE(40) - 1) * 90) as NativeDisplay['rotation']
    const denominator = path.readUInt32LE(52)
    const mode = {
      width: source.readUInt32LE(16),
      height: source.readUInt32LE(20),
      refreshRate: denominator ? path.readUInt32LE(48) / denominator : 60,
    }
    return {
      id,
      name,
      mode,
      modes: getModes(gdi),
      x: source.readInt32LE(28),
      y: source.readInt32LE(32),
      rotation,
      primary: source.readInt32LE(28) === 0 && source.readInt32LE(32) === 0,
      connection:
        (
          {
            5: 'HDMI',
            10: 'DisplayPort',
            11: '内置 DisplayPort',
            6: 'LVDS',
            4: 'DVI',
            15: 'Miracast',
            16: '间接有线',
          } as Record<number, string>
        )[technology] ?? `系统接口 ${technology}`,
      hdr,
    }
  })
}
export function restore(snapshot: CcdSnapshot): void {
  check(
    setConfig(snapshot.pathCount, snapshot.paths, snapshot.modeCount, snapshot.modes, 0x20 | 0x80),
    '恢复显示配置',
  )
  for (const [id, enabled] of Object.entries(snapshot.colors ?? {})) setHdr(id, enabled)
}
export function setHdr(id: string, enabled: boolean): void {
  const entry = records(capture()).find((e) => e.id === id)
  if (!entry) throw new Error('HDR 目标设备已断开')
  const capability = info(entry.path, true, 9, 32).readUInt32LE(20)
  if (!(capability & 1)) throw new Error('显示器不支持高级颜色')
  const payload = Buffer.alloc(24)
  payload.writeUInt32LE(10)
  payload.writeUInt32LE(24, 4)
  entry.path.copy(payload, 8, 20, 32)
  payload.writeUInt32LE(enabled ? 1 : 0, 20)
  check(setDeviceInfo(payload), '设置 HDR')
}
export function persist(): void {
  const snapshot = capture()
  check(
    setConfig(
      snapshot.pathCount,
      snapshot.paths,
      snapshot.modeCount,
      snapshot.modes,
      0x20 | 0x80 | 0x200,
    ),
    '保存显示配置',
  )
}
export function apply(plan: ChangePlan): void {
  if (plan.topology) {
    if (plan.displays.length) throw new Error('拓扑切换和逐屏模式修改不能混合提交')
    const flag = { internal: 1, clone: 2, extend: 4, external: 8 }[plan.topology]
    check(setConfig(0, null, 0, null, flag | 0x40), '验证拓扑')
    check(setConfig(0, null, 0, null, flag | 0x80), '切换拓扑')
    return
  }
  const snapshot = capture(),
    entries = records(snapshot),
    devices = enumerate(snapshot)
  if (!plan.displays.length) throw new Error('没有要应用的显示配置')
  if (new Set(entries.map((e) => e.gdi)).size !== entries.length)
    throw new Error('复制模式下请先切换为扩展模式再修改单屏')
  const desired = devices.map((d) => plan.displays.find((p) => p.id === d.id) ?? d)
  if (plan.displays.some((p) => !devices.some((d) => d.id === p.id)))
    throw new Error('方案所需显示器已断开')
  if (new Set(plan.displays.map((d) => d.id)).size !== plan.displays.length)
    throw new Error('重复的显示器设置')
  const origin = validateLayout(desired)
  for (const setting of desired) {
    const entry = entries.find((e) => e.id === setting.id)!
    const device = devices.find((d) => d.id === setting.id)!
    const rotated = setting.rotation % 180 !== device.rotation % 180
    const supported = device.modes.some(
      (m) =>
        m.width === (rotated ? setting.mode.height : setting.mode.width) &&
        m.height === (rotated ? setting.mode.width : setting.mode.height) &&
        Math.abs(m.refreshRate - setting.mode.refreshRate) < 1,
    )
    const unchanged =
      setting.mode.width === device.mode.width &&
      setting.mode.height === device.mode.height &&
      Math.abs(setting.mode.refreshRate - device.mode.refreshRate) < 0.01 &&
      setting.rotation === device.rotation
    if (!supported && !unchanged) throw new Error(`${device.name} 不支持请求的模式`)
    entry.source.writeUInt32LE(setting.mode.width, 16)
    entry.source.writeUInt32LE(setting.mode.height, 20)
    entry.source.writeInt32LE(setting.x - origin.x, 28)
    entry.source.writeInt32LE(setting.y - origin.y, 32)
    entry.path.writeUInt32LE(setting.rotation / 90 + 1, 40)
    if (!unchanged) {
      entry.path.writeUInt32LE(0xffffffff, 32)
      entry.path.writeUInt32LE(Math.round(setting.mode.refreshRate * 1000), 48)
      entry.path.writeUInt32LE(1000, 52)
    }
  }
  check(
    setConfig(
      snapshot.pathCount,
      snapshot.paths,
      snapshot.modeCount,
      snapshot.modes,
      0x20 | 0x40 | 0x400,
    ),
    '验证显示模式',
  )
  check(
    setConfig(
      snapshot.pathCount,
      snapshot.paths,
      snapshot.modeCount,
      snapshot.modes,
      0x20 | 0x80 | 0x400,
    ),
    '应用显示模式',
  )
  for (const setting of desired)
    if (setting.hdrEnabled !== undefined) setHdr(setting.id, setting.hdrEnabled)
}

const callback = koffi.proto(
  'int __stdcall ScreenToolsMonitorCallback(void *, void *, void *, intptr_t)',
)
const enumMonitors = user.func('EnumDisplayMonitors', 'int', [
  'void *',
  'void *',
  koffi.pointer(callback),
  'intptr_t',
])
const monitorInfo = user.func('int __stdcall GetMonitorInfoW(void *, void *)')
const countPhysical = dxva.func(
  'int __stdcall GetNumberOfPhysicalMonitorsFromHMONITOR(void *, void *)',
)
const getPhysical = dxva.func(
  'int __stdcall GetPhysicalMonitorsFromHMONITOR(void *, uint32_t, void *)',
)
const destroyPhysical = dxva.func('int __stdcall DestroyPhysicalMonitors(uint32_t, void *)')
const brightnessGet = dxva.func(
  'int __stdcall GetMonitorBrightness(void *, void *, void *, void *)',
)
const contrastGet = dxva.func('int __stdcall GetMonitorContrast(void *, void *, void *, void *)')
const brightnessSet = dxva.func('int __stdcall SetMonitorBrightness(void *, uint32_t)')
const contrastSet = dxva.func('int __stdcall SetMonitorContrast(void *, uint32_t)')
const vcpGet = dxva.func(
  'int __stdcall GetVCPFeatureAndVCPFeatureReply(void *, uint8_t, void *, void *, void *)',
)
const vcpSet = dxva.func('int __stdcall SetVCPFeature(void *, uint8_t, uint32_t)')
const capLength = dxva.func('int __stdcall GetCapabilitiesStringLength(void *, void *)')
const capString = dxva.func(
  'int __stdcall CapabilitiesRequestAndCapabilitiesReply(void *, void *, uint32_t)',
)

function withPhysical<T>(id: string, operation: (handle: bigint) => T): T {
  const entries = records(capture())
  const entry = entries.find((e) => e.id === id)
  if (!entry) throw new Error('显示器已断开')
  if (entries.filter((e) => e.gdi === entry.gdi).length !== 1)
    throw new Error('复制模式下无法唯一匹配物理显示器')
  let result: T | undefined,
    error: unknown,
    found = false
  enumMonitors(
    null,
    null,
    (handle: bigint) => {
      try {
        const mi = Buffer.alloc(104)
        mi.writeUInt32LE(104)
        if (!monitorInfo(handle, mi) || text(mi, 40, 64) !== entry.gdi) return 1
        const count = Buffer.alloc(4)
        if (!countPhysical(handle, count)) throw new Error(`读取物理显示器失败：${lastError()}`)
        const n = count.readUInt32LE()
        if (n < 1 || n > 32) throw new Error('没有可控的物理显示器')
        const bytes = Buffer.alloc(n * 264)
        if (!getPhysical(handle, n, bytes)) throw new Error(`获取显示器句柄失败：${lastError()}`)
        try {
          if (n !== 1) throw new Error('一个逻辑显示器对应多个物理设备，无法安全确定目标')
          found = true
          result = operation(bytes.readBigUInt64LE())
        } finally {
          destroyPhysical(n, bytes)
        }
        return 0
      } catch (cause) {
        error = cause
        return 0
      }
    },
    0,
  )
  if (error) throw error
  if (!found) throw new Error('物理显示器不可用')
  return result as T
}
function probeHandle(handle: bigint): HardwareCapabilities {
  const capabilities: HardwareCapabilities = {}
  for (const [feature, read] of [
    ['brightness', brightnessGet],
    ['contrast', contrastGet],
  ] as const) {
    const min = Buffer.alloc(4),
      current = Buffer.alloc(4),
      max = Buffer.alloc(4)
    if (read(handle, min, current, max) && max.readUInt32LE() > min.readUInt32LE())
      capabilities[feature] = {
        min: min.readUInt32LE(),
        max: max.readUInt32LE(),
        current: current.readUInt32LE(),
      }
  }
  // 只有能力字符串明确声明且读取成功的白名单 VCP 才开放写入。
  const length = Buffer.alloc(4)
  if (capLength(handle, length) && length.readUInt32LE() > 0 && length.readUInt32LE() < 65536) {
    const bytes = Buffer.alloc(length.readUInt32LE())
    if (capString(handle, bytes, bytes.length)) {
      const capabilityText = bytes.toString('ascii').toLowerCase()
      for (const [feature, code] of [
        ['volume', 0x62],
        ['inputSource', 0x60],
        ['power', 0xd6],
      ] as const) {
        const match = new RegExp(
          `(?:\\s|\\()${code.toString(16)}(?:\\(([^)]*)\\))?(?=\\s|\\))`,
        ).exec(capabilityText)
        if (!match) continue
        const current = Buffer.alloc(4),
          max = Buffer.alloc(4),
          type = Buffer.alloc(4)
        if (!vcpGet(handle, code, type, current, max)) continue
        const values = match[1]
          ?.trim()
          .split(/\s+/)
          .map((s) => Number.parseInt(s, 16))
          .filter(Number.isFinite)
        if (feature !== 'volume' && !values?.length) continue
        capabilities[feature] = {
          min: 0,
          max: max.readUInt32LE(),
          current: current.readUInt32LE(),
          ...(values ? { values } : {}),
        }
      }
    }
  }
  return capabilities
}
export function probe(id: string): HardwareCapabilities {
  return withPhysical(id, probeHandle)
}
export function pollHardware(request: HardwarePollRequest): HardwareCapabilities {
  return withPhysical(request.id, (handle) => {
    const result: HardwareCapabilities = {}
    for (const feature of ['brightness', 'contrast'] as const) {
      const cached = request.capabilities[feature]
      if (!cached) continue
      const read = feature === 'brightness' ? brightnessGet : contrastGet
      const min = Buffer.alloc(4),
        current = Buffer.alloc(4),
        max = Buffer.alloc(4)
      if (read(handle, min, current, max) && max.readUInt32LE() > min.readUInt32LE()) {
        result[feature] = {
          ...cached,
          min: min.readUInt32LE(),
          max: max.readUInt32LE(),
          current: current.readUInt32LE(),
        }
      }
    }
    for (const [feature, code] of [
      ['volume', 0x62],
      ['inputSource', 0x60],
      ['power', 0xd6],
    ] as const) {
      const cached = request.capabilities[feature]
      if (!cached) continue
      const type = Buffer.alloc(4),
        current = Buffer.alloc(4),
        max = Buffer.alloc(4)
      if (vcpGet(handle, code, type, current, max)) {
        const reportedMax = max.readUInt32LE()
        result[feature] = {
          ...cached,
          current: current.readUInt32LE(),
          max: reportedMax > cached.min ? reportedMax : cached.max,
        }
      }
    }
    return result
  })
}
export function writeHardware(request: HardwareWriteRequest): HardwareCapabilities {
  const { setting, capability } = request
  return withPhysical(setting.id, (handle) => {
    if (setting.feature === 'brightness' || setting.feature === 'contrast') {
      const write = setting.feature === 'brightness' ? brightnessSet : contrastSet
      const value = percentageToRaw(setting.value, capability.min, capability.max)
      if (!write(handle, value)) throw new Error(`硬件写入失败，Windows 错误码 ${lastError()}`)
      // 立即展示已提交值；设备实际值由定时轮询校准，不在每次操作后回读。
      return { [setting.feature]: { ...capability, current: value } }
    }
    const value =
      setting.feature === 'volume'
        ? percentageToRaw(setting.value, capability.min, capability.max)
        : setting.value
    if (!Number.isInteger(value)) throw new Error('参数超出显示器能力范围')
    if (
      capability.values
        ? !capability.values.includes(value)
        : value < capability.min || value > capability.max
    )
      throw new Error('参数超出显示器能力范围')
    const ok = vcpSet(
      handle,
      { volume: 0x62, inputSource: 0x60, power: 0xd6 }[setting.feature],
      value,
    )
    if (!ok) throw new Error(`硬件写入失败，Windows 错误码 ${lastError()}`)
    // 电源或输入切换后设备可能立即不可达，不伪造读取确认。
    if (setting.feature === 'power' || setting.feature === 'inputSource') return {}
    return { volume: { ...capability, current: value } }
  })
}
