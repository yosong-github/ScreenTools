import { describe, expect, it } from 'vitest'
import { percentageToRaw, validateLayout } from './validation'
const display = {
  id: 'a',
  x: 0,
  y: 0,
  primary: true,
  rotation: 0 as const,
  mode: { width: 1920, height: 1080, refreshRate: 60 },
}
describe('显示布局与硬件数值边界', () => {
  it('允许负坐标和相接边缘，拒绝重叠、多个主屏、空布局和重复目标', () => {
    const left = { ...display, id: 'b', x: -1920, primary: false }
    expect(validateLayout([display, left])).toBe(display)
    expect(() => validateLayout([display, { ...left, x: -1919 }])).toThrow('重叠')
    expect(() => validateLayout([display, { ...left, primary: true }])).toThrow('主显示器')
    expect(() => validateLayout([])).toThrow()
    expect(() => validateLayout([display, { ...left, id: 'a' }])).toThrow('重复')
  })
  it('按每台设备真实范围转换百分比，不静默修正非法输入', () => {
    expect(percentageToRaw(0, 10, 210)).toBe(10)
    expect(percentageToRaw(50, 10, 210)).toBe(110)
    expect(percentageToRaw(100, 10, 210)).toBe(210)
    expect(() => percentageToRaw(101, 0, 100)).toThrow()
    expect(() => percentageToRaw(NaN, 0, 100)).toThrow()
    expect(() => percentageToRaw(50, 100, 0)).toThrow()
  })
})
