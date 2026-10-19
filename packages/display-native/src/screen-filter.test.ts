import { describe, expect, it, vi } from 'vitest'
import {
  createCustomFilterMatrix,
  defaultCustomFilterSettings,
  identityColorMatrix,
  screenFilterPresets,
  type ColorMatrix,
} from '@screentools/display-core'
import { createScreenFilterController, type ScreenFilterBindings } from './screen-filter'

function testBindings(initial: ColorMatrix = identityColorMatrix): {
  bindings: ScreenFilterBindings
  set: ReturnType<typeof vi.fn>
  uninitialize: ReturnType<typeof vi.fn>
} {
  let current = initial
  const set = vi.fn((matrix: ColorMatrix) => {
    current = matrix
    return true
  })
  const uninitialize = vi.fn(() => true)
  return {
    bindings: {
      initialize: () => true,
      uninitialize,
      getColorEffect: () => current,
      setColorEffect: set,
      lastError: () => 0,
    },
    set,
    uninitialize,
  }
}

describe('屏幕滤镜原生控制器', () => {
  it('应用预设并在关闭时恢复初始矩阵', () => {
    const { bindings, set, uninitialize } = testBindings()
    const controller = createScreenFilterController(bindings)
    expect(controller.getStatus()).toEqual({
      available: true,
      active: 'off',
      customId: null,
      reason: null,
    })
    expect(controller.apply('reading').active).toBe('reading')
    expect(set).toHaveBeenLastCalledWith(screenFilterPresets[0]!.matrix)
    controller.dispose()
    expect(set).toHaveBeenLastCalledWith(identityColorMatrix)
    expect(uninitialize).toHaveBeenCalledOnce()
    expect(() => controller.dispose()).not.toThrow()
  })

  it('原色恢复 baseline 而不是额外持有滤镜', () => {
    const { bindings, set } = testBindings()
    const controller = createScreenFilterController(bindings)
    controller.apply('night')
    expect(controller.apply('off')).toEqual({
      available: true,
      active: 'off',
      customId: null,
      reason: null,
    })
    expect(set).toHaveBeenLastCalledWith(identityColorMatrix)
    const calls = set.mock.calls.length
    controller.dispose()
    expect(set).toHaveBeenCalledTimes(calls)
  })

  it('不覆盖已有的系统颜色效果', () => {
    const external = screenFilterPresets[2]!.matrix
    const { bindings, set } = testBindings(external)
    const controller = createScreenFilterController(bindings)
    expect(controller.getStatus()).toEqual({
      available: false,
      active: 'off',
      customId: null,
      reason: '系统或其他程序正在使用颜色滤镜',
    })
    expect(() => controller.apply('reading')).toThrow('正在使用颜色滤镜')
    controller.dispose()
    expect(set).not.toHaveBeenCalled()
  })

  it('验证系统回读，失败时恢复先前矩阵', () => {
    const { bindings, set } = testBindings()
    bindings.getColorEffect = vi
      .fn()
      .mockReturnValueOnce(identityColorMatrix)
      .mockReturnValueOnce(identityColorMatrix)
      .mockReturnValueOnce(identityColorMatrix)
    const controller = createScreenFilterController(bindings)
    expect(() => controller.apply('night')).toThrow('未确认')
    expect(set).toHaveBeenLastCalledWith(identityColorMatrix)
  })

  it('应用自定义矩阵，跟踪方案并在退出时恢复原色', () => {
    const { bindings, set } = testBindings()
    const controller = createScreenFilterController(bindings)
    const matrix = createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      red: 120,
      blue: 80,
      saturation: 90,
    })
    expect(controller.applyCustom('mine', matrix)).toEqual({
      available: true,
      active: 'custom',
      customId: 'mine',
      reason: null,
    })
    expect(controller.getStatus().customId).toBe('mine')
    expect(set).toHaveBeenLastCalledWith(matrix)
    controller.dispose()
    expect(set).toHaveBeenLastCalledWith(identityColorMatrix)
    expect(() => controller.applyCustom('bad', [1] as never)).toThrow('无效的自定义滤镜矩阵')
  })
})
