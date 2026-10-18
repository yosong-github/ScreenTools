import { describe, expect, it } from 'vitest'
import {
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
})
