import type { HardwareCapabilities, HardwareSetting } from '@screentools/contracts'

export const scenePresets = [
  { id: 'day', label: '日间', icon: 'sun', brightness: 80, contrast: 70 },
  { id: 'reading', label: '阅读', icon: 'book', brightness: 45, contrast: 65 },
  { id: 'movie', label: '观影', icon: 'film', brightness: 60, contrast: 80 },
  { id: 'night', label: '夜间', icon: 'moon', brightness: 25, contrast: 55 },
] as const

export type ScenePreset = (typeof scenePresets)[number]
type SceneFeature = 'brightness' | 'contrast'

function availableFeatures(capabilities: HardwareCapabilities): SceneFeature[] {
  return (['brightness', 'contrast'] as const).filter((feature) => {
    const value = capabilities[feature]
    return (
      value && Number.isFinite(value.min) && Number.isFinite(value.max) && value.max > value.min
    )
  })
}

export function sceneHardwareSettings(
  deviceId: string,
  capabilities: HardwareCapabilities,
  scene: ScenePreset,
): HardwareSetting[] {
  if (!deviceId) return []
  // 原生硬件写入接口接收百分比，并负责按显示器的 min/max 换算为设备值。
  return availableFeatures(capabilities).map((feature) => ({
    id: deviceId,
    feature,
    value: scene[feature],
  }))
}

export function sceneMatches(capabilities: HardwareCapabilities, scene: ScenePreset): boolean {
  const features = availableFeatures(capabilities)
  return (
    features.length > 0 &&
    features.every((feature) => {
      const value = capabilities[feature]!
      const target = Math.round(value.min + ((value.max - value.min) * scene[feature]) / 100)
      return Math.abs(value.current - target) <= Math.max(1, (value.max - value.min) * 0.02)
    })
  )
}
