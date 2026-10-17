import type { DisplaySetting } from '@screentools/contracts'

export function validateLayout(displays: DisplaySetting[]): DisplaySetting {
  const primary = displays.filter((d) => d.primary)
  if (primary.length !== 1) throw new Error('必须且只能设置一个主显示器')
  if (new Set(displays.map((d) => d.id)).size !== displays.length)
    throw new Error('重复的显示器设置')
  for (let i = 0; i < displays.length; i++)
    for (let j = i + 1; j < displays.length; j++) {
      const a = displays[i]!,
        b = displays[j]!
      if (
        a.x < b.x + b.mode.width &&
        a.x + a.mode.width > b.x &&
        a.y < b.y + b.mode.height &&
        a.y + a.mode.height > b.y
      )
        throw new Error('显示器位置不能重叠')
    }
  return primary[0]!
}

export function percentageToRaw(value: number, min: number, max: number): number {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min
  )
    throw new Error('无效的百分比或硬件范围')
  return Math.round(min + ((max - min) * value) / 100)
}
