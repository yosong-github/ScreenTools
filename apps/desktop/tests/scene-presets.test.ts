import { describe, expect, it } from 'vitest'
import {
  sceneHardwareSettings,
  sceneMatches,
  scenePresets,
} from '../src/renderer/src/views/picture/scene-presets'

const [day, reading, movie, night] = scenePresets

describe('画面场景', () => {
  it('四个场景分别提交亮度与对比度百分比，不修改布局', () => {
    const capabilities = {
      brightness: { min: 20, max: 80, current: 20 },
      contrast: { min: 0, max: 100, current: 0 },
    }
    expect(sceneHardwareSettings('display-1', capabilities, day!)).toEqual([
      { id: 'display-1', feature: 'brightness', value: 80 },
      { id: 'display-1', feature: 'contrast', value: 70 },
    ])
    expect(
      sceneHardwareSettings('display-1', capabilities, reading!).map((item) => item.value),
    ).toEqual([45, 65])
    expect(
      sceneHardwareSettings('display-1', capabilities, movie!).map((item) => item.value),
    ).toEqual([60, 80])
    expect(
      sceneHardwareSettings('display-1', capabilities, night!).map((item) => item.value),
    ).toEqual([25, 55])
  })

  it('只写设备支持且范围有效的功能', () => {
    expect(
      sceneHardwareSettings('display-1', { brightness: { min: 0, max: 100, current: 30 } }, night!),
    ).toEqual([{ id: 'display-1', feature: 'brightness', value: 25 }])
    expect(
      sceneHardwareSettings('display-1', { contrast: { min: 20, max: 20, current: 20 } }, night!),
    ).toEqual([])
    expect(
      sceneHardwareSettings('', { brightness: { min: 0, max: 100, current: 30 } }, night!),
    ).toEqual([])
  })

  it('按设备实际范围识别当前场景', () => {
    const capabilities = {
      brightness: { min: 20, max: 80, current: 68 },
      contrast: { min: 0, max: 100, current: 70 },
    }
    expect(sceneMatches(capabilities, day!)).toBe(true)
    expect(sceneMatches(capabilities, night!)).toBe(false)
    expect(sceneMatches({}, day!)).toBe(false)
  })
})
