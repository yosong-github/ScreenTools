import type { ScreenFilterId } from '@screentools/contracts'

export type ColorMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export interface ScreenFilterPreset {
  id: Exclude<ScreenFilterId, 'off'>
  label: string
  matrix: ColorMatrix
}

export const identityColorMatrix: ColorMatrix = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
]

export const screenFilterPresets: readonly ScreenFilterPreset[] = [
  {
    id: 'reading',
    label: '阅读',
    matrix: [1, 0, 0, 0, 0, 0, 0.92, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  },
  {
    id: 'night',
    label: '夜间',
    matrix: [0.82, 0, 0, 0, 0, 0, 0.68, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  },
  {
    id: 'grayscale',
    label: '灰度',
    // 使用 Windows Magnification API 文档给出的灰度矩阵。
    matrix: [
      0.3, 0.3, 0.3, 0, 0, 0.6, 0.6, 0.6, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
    ],
  },
]

export const screenFilterIds: readonly ScreenFilterId[] = [
  'off',
  ...screenFilterPresets.map(({ id }) => id),
]

export function getScreenFilterMatrix(id: ScreenFilterId): ColorMatrix {
  if (id === 'off') return identityColorMatrix
  const preset = screenFilterPresets.find((entry) => entry.id === id)
  if (!preset) throw new Error('未知的屏幕滤镜')
  return preset.matrix
}

// Windows 按行向量乘 5×5 矩阵；SVG feColorMatrix 按列向量使用 4×5 矩阵。
export function toSvgColorMatrixValues(matrix: ColorMatrix): string {
  const values: number[] = []
  for (let output = 0; output < 4; output++) {
    for (let input = 0; input < 5; input++) values.push(matrix[input * 5 + output]!)
  }
  return values.join(' ')
}

export function colorMatricesEqual(
  left: readonly number[],
  right: readonly number[],
  epsilon = 0.0001,
): boolean {
  return (
    left.length === 25 &&
    right.length === 25 &&
    left.every((value, index) => Math.abs(value - right[index]!) <= epsilon)
  )
}
