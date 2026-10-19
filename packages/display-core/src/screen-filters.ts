import type { CustomFilterSettings, ScreenFilterId } from '@screentools/contracts'

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

export const defaultCustomFilterSettings: CustomFilterSettings = {
  brightness: 0,
  contrast: 0,
  temperature: 6500,
  blackLevel: 0,
  red: 100,
  green: 100,
  blue: 100,
  saturation: 100,
}

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
  {
    id: 'fps-competitive',
    label: 'FPS 竞技',
    matrix: createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      contrast: 8,
      blackLevel: 5,
      saturation: 112,
    }),
  },
  {
    id: 'fps-vivid',
    label: 'FPS 鲜艳',
    matrix: createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      contrast: 6,
      blackLevel: 3,
      saturation: 135,
    }),
  },
  {
    id: 'fps-dark',
    label: 'FPS 暗场',
    matrix: createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      contrast: -8,
      blackLevel: 5,
      saturation: 108,
    }),
  },
  {
    id: 'fps-focus',
    label: 'FPS 专注',
    matrix: createCustomFilterMatrix({
      ...defaultCustomFilterSettings,
      contrast: 6,
      blackLevel: 4,
      saturation: 90,
    }),
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

export function createCustomFilterMatrix(settings: CustomFilterSettings): ColorMatrix {
  if (
    [settings.red, settings.green, settings.blue].some(
      (value) => !Number.isFinite(value) || value < 20 || value > 200,
    ) ||
    !Number.isFinite(settings.saturation) ||
    settings.saturation < 0 ||
    settings.saturation > 200 ||
    !Number.isFinite(settings.brightness) ||
    Math.abs(settings.brightness) > 50 ||
    !Number.isFinite(settings.contrast) ||
    Math.abs(settings.contrast) > 50 ||
    !Number.isFinite(settings.blackLevel) ||
    Math.abs(settings.blackLevel) > 20 ||
    !Number.isFinite(settings.temperature) ||
    settings.temperature < 3000 ||
    settings.temperature > 10000
  )
    throw new Error('自定义滤镜参数超出允许范围')

  const temperature = (settings.temperature - 6500) / 3500
  const temperatureGains = [
    1 + Math.max(0, -temperature) * 0.15 - Math.max(0, temperature) * 0.2,
    1,
    1 - Math.max(0, -temperature) * 0.35 + Math.max(0, temperature) * 0.2,
  ]
  const gains = [settings.red, settings.green, settings.blue].map(
    (value, index) => (value / 100) * temperatureGains[index]!,
  )
  const brightness = 1 + settings.brightness / 100
  const contrast = 1 + settings.contrast / 100
  const offset = (1 - contrast) / 2 + settings.blackLevel / 100
  const saturation = settings.saturation / 100
  const luminance = [0.2126, 0.7152, 0.0722]
  const matrix = [...identityColorMatrix]
  for (let input = 0; input < 3; input++) {
    for (let output = 0; output < 3; output++) {
      matrix[input * 5 + output] =
        gains[output]! *
        brightness *
        contrast *
        ((input === output ? saturation : 0) + (1 - saturation) * luminance[input]!)
    }
    matrix[20 + input] = gains[input]! * offset
  }
  return matrix as unknown as ColorMatrix
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
