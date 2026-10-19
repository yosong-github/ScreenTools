import { describe, expect, it } from 'vitest'
import {
  createCustomFilterMatrix,
  defaultCustomFilterSettings,
  colorMatricesEqual,
  getScreenFilterMatrix,
  identityColorMatrix,
  screenFilterIds,
  screenFilterPresets,
  toSvgColorMatrixValues,
} from './screen-filters'

describe('屏幕滤镜矩阵', () => {
  it('预设 ID 唯一且矩阵包含 25 个有限数字', () => {
    expect(new Set(screenFilterIds).size).toBe(screenFilterIds.length)
    for (const preset of screenFilterPresets) {
      expect(preset.matrix).toHaveLength(25)
      expect(preset.matrix.every(Number.isFinite)).toBe(true)
    }
  })

  it('原色返回单位矩阵，未知滤镜被拒绝', () => {
    expect(getScreenFilterMatrix('off')).toBe(identityColorMatrix)
    expect(() => getScreenFilterMatrix('unknown' as never)).toThrow('未知的屏幕滤镜')
  })

  it('FPS 预设分别增强色彩并提亮暗场', () => {
    const competitive = getScreenFilterMatrix('fps-competitive')
    const vivid = getScreenFilterMatrix('fps-vivid')
    const dark = getScreenFilterMatrix('fps-dark')
    const focus = getScreenFilterMatrix('fps-focus')
    expect(competitive).toEqual(
      createCustomFilterMatrix({
        ...defaultCustomFilterSettings,
        contrast: 8,
        blackLevel: 5,
        saturation: 112,
      }),
    )
    expect(vivid[0]).toBeGreaterThan(competitive[0])
    expect(dark[20]).toBeGreaterThan(competitive[20])
    expect(focus[0]).toBeLessThan(competitive[0])
    expect(
      new Set([competitive.join(','), vivid.join(','), dark.join(','), focus.join(',')]).size,
    ).toBe(4)
  })

  it('比较矩阵时容忍浮点误差但拒绝实际变化', () => {
    const close = [...identityColorMatrix]
    close[0]! += 0.00001
    expect(colorMatricesEqual(identityColorMatrix, close)).toBe(true)
    close[0]! += 0.01
    expect(colorMatricesEqual(identityColorMatrix, close)).toBe(false)
    expect(colorMatricesEqual(identityColorMatrix, identityColorMatrix.slice(1))).toBe(false)
  })

  it('将 Windows 矩阵转为 SVG 预览矩阵', () => {
    expect(toSvgColorMatrixValues(identityColorMatrix).split(' ').map(Number)).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ])
    expect(
      toSvgColorMatrixValues(getScreenFilterMatrix('grayscale')).split(' ').map(Number),
    ).toEqual([0.3, 0.6, 0.1, 0, 0, 0.3, 0.6, 0.1, 0, 0, 0.3, 0.6, 0.1, 0, 0, 0, 0, 0, 1, 0])
  })

  it('自定义参数生成同一套原生与预览矩阵，并拒绝越界值', () => {
    expect(createCustomFilterMatrix(defaultCustomFilterSettings)).toEqual(identityColorMatrix)
    const warm = createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      red: 150,
      green: 80,
      blue: 60,
    })
    expect([warm[0], warm[6], warm[12]]).toEqual([1.5, 0.8, 0.6])
    expect(toSvgColorMatrixValues(warm).split(' ').map(Number)[0]).toBe(1.5)
    const gray = createCustomFilterMatrix({ ...defaultCustomFilterSettings, saturation: 0 })
    expect([gray[0], gray[1], gray[2]]).toEqual([0.2126, 0.2126, 0.2126])
    expect(() =>
      createCustomFilterMatrix({ ...defaultCustomFilterSettings, red: Number.NaN }),
    ).toThrow('超出允许范围')
    expect(() => createCustomFilterMatrix({ ...defaultCustomFilterSettings, red: 0 })).toThrow(
      '超出允许范围',
    )
    const adjusted = createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      brightness: 20,
      contrast: 10,
      blackLevel: 5,
    })
    expect(adjusted[0]).toBeCloseTo(1.32)
    expect(adjusted[20]).toBeCloseTo(0)
    const cool = createCustomFilterMatrix({ ...defaultCustomFilterSettings, temperature: 10000 })
    expect(cool[0]).toBeCloseTo(0.8)
    expect(cool[12]).toBeCloseTo(1.2)
  })
})
