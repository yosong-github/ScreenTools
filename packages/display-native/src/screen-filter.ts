import koffi from 'koffi'
import {
  colorMatricesEqual,
  getScreenFilterMatrix,
  identityColorMatrix,
  screenFilterIds,
  type ColorMatrix,
} from '@screentools/display-core'
import type { ScreenFilterId, ScreenFilterState } from '@screentools/contracts'

export interface ScreenFilterBindings {
  initialize(): boolean
  uninitialize(): boolean
  getColorEffect(): ColorMatrix | null
  setColorEffect(matrix: ColorMatrix): boolean
  lastError(): number
}

export interface ScreenFilterController {
  getStatus(): ScreenFilterState
  apply(id: ScreenFilterId): ScreenFilterState
  applyCustom(id: string, matrix: ColorMatrix): ScreenFilterState
  dispose(): void
}

function failureMessage(operation: string, bindings: ScreenFilterBindings): string {
  return `${operation}失败，Windows 错误码 ${bindings.lastError()}`
}

export function createScreenFilterController(
  bindings: ScreenFilterBindings,
): ScreenFilterController {
  let initialized = false
  let baseline: ColorMatrix | null = null
  let active: ScreenFilterId | 'custom' = 'off'
  let customId: string | null = null
  let activeMatrix: ColorMatrix | null = null
  let ownsEffect = false
  let unavailableReason: string | null = null

  function unavailable(reason: string): ScreenFilterState {
    unavailableReason = reason
    return { available: false, active: 'off', customId: null, reason }
  }

  function status(): ScreenFilterState {
    return { available: true, active, customId, reason: null }
  }

  function initialize(): ScreenFilterState {
    if (initialized) {
      return unavailableReason
        ? { available: false, active: 'off', customId: null, reason: unavailableReason }
        : status()
    }
    if (!bindings.initialize()) return unavailable(failureMessage('初始化屏幕滤镜', bindings))
    initialized = true
    baseline = bindings.getColorEffect()
    if (!baseline) return unavailable(failureMessage('读取当前屏幕颜色', bindings))
    if (!colorMatricesEqual(baseline, identityColorMatrix))
      return unavailable('系统或其他程序正在使用颜色滤镜')
    unavailableReason = null
    return status()
  }

  function getStatus(): ScreenFilterState {
    const status = initialize()
    if (!status.available || !ownsEffect) return status
    const expected = activeMatrix
    const current = bindings.getColorEffect()
    if (!current || !expected || !colorMatricesEqual(current, expected)) {
      ownsEffect = false
      active = 'off'
      customId = null
      activeMatrix = null
      return unavailable('屏幕滤镜已被系统或其他程序替换')
    }
    return status
  }

  function apply(id: ScreenFilterId): ScreenFilterState {
    if (!screenFilterIds.includes(id)) throw new Error('未知的屏幕滤镜')
    initialize()
    return applyMatrix(id, null, id === 'off' ? baseline : getScreenFilterMatrix(id))
  }

  function applyCustom(id: string, matrix: ColorMatrix): ScreenFilterState {
    if (
      !id ||
      !Array.isArray(matrix) ||
      matrix.length !== 25 ||
      matrix.some((value) => !Number.isFinite(value) || Math.abs(value) > 4)
    )
      throw new Error('无效的自定义滤镜矩阵')
    return applyMatrix('custom', id, matrix)
  }

  function applyMatrix(
    next: ScreenFilterId | 'custom',
    nextCustomId: string | null,
    target: ColorMatrix | null,
  ): ScreenFilterState {
    const currentStatus = initialize()
    if (!currentStatus.available || !baseline || !target)
      throw new Error(currentStatus.reason ?? '屏幕滤镜不可用')
    const previous = bindings.getColorEffect()
    if (!previous) throw new Error(failureMessage('读取当前屏幕颜色', bindings))
    if (!bindings.setColorEffect(target)) throw new Error(failureMessage('应用屏幕滤镜', bindings))
    const applied = bindings.getColorEffect()
    if (!applied || !colorMatricesEqual(applied, target)) {
      bindings.setColorEffect(previous)
      throw new Error('系统未确认屏幕滤镜变更')
    }
    active = next
    customId = nextCustomId
    activeMatrix = target
    ownsEffect = next !== 'off'
    return status()
  }

  function dispose(): void {
    if (!initialized) return
    try {
      if (ownsEffect && baseline) bindings.setColorEffect(baseline)
    } finally {
      bindings.uninitialize()
      initialized = false
      baseline = null
      active = 'off'
      customId = null
      activeMatrix = null
      ownsEffect = false
      unavailableReason = null
    }
  }

  return { getStatus, apply, applyCustom, dispose }
}

function matrixBuffer(matrix?: ColorMatrix): Buffer {
  const buffer = Buffer.alloc(25 * 4)
  matrix?.forEach((value, index) => buffer.writeFloatLE(value, index * 4))
  return buffer
}

function readMatrix(buffer: Buffer): ColorMatrix {
  return Array.from({ length: 25 }, (_, index) =>
    buffer.readFloatLE(index * 4),
  ) as unknown as ColorMatrix
}

function createBindings(): ScreenFilterBindings {
  const magnification = koffi.load('Magnification.dll')
  const kernel = koffi.load('kernel32.dll')
  const initialize = magnification.func('int __stdcall MagInitialize()')
  const uninitialize = magnification.func('int __stdcall MagUninitialize()')
  const getColorEffect = magnification.func('int __stdcall MagGetFullscreenColorEffect(void *)')
  const setColorEffect = magnification.func('int __stdcall MagSetFullscreenColorEffect(void *)')
  const lastError = kernel.func('uint32_t __stdcall GetLastError()')
  return {
    initialize: () => !!initialize(),
    uninitialize: () => !!uninitialize(),
    getColorEffect: () => {
      const buffer = matrixBuffer()
      return getColorEffect(buffer) ? readMatrix(buffer) : null
    },
    setColorEffect: (matrix) => !!setColorEffect(matrixBuffer(matrix)),
    lastError,
  }
}

let controller: ScreenFilterController | null | undefined
let loadFailure = '当前系统不支持屏幕滤镜'

function getController(): ScreenFilterController | null {
  if (controller !== undefined) return controller
  try {
    controller = createScreenFilterController(createBindings())
  } catch {
    controller = null
    loadFailure = '当前 Windows 环境无法加载屏幕滤镜组件'
  }
  return controller
}

export function getScreenFilterStatus(): ScreenFilterState {
  return getController()?.getStatus() ?? { available: false, active: 'off', reason: loadFailure }
}

export function applyScreenFilter(id: ScreenFilterId): ScreenFilterState {
  const current = getController()
  if (!current) throw new Error(loadFailure)
  return current.apply(id)
}

export function applyCustomScreenFilter(id: string, matrix: ColorMatrix): ScreenFilterState {
  const current = getController()
  if (!current) throw new Error(loadFailure)
  return current.applyCustom(id, matrix)
}

export function disposeScreenFilter(): void {
  try {
    controller?.dispose()
  } finally {
    controller = undefined
  }
}
