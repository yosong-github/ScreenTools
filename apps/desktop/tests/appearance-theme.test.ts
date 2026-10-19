import { describe, expect, it } from 'vitest'
import { resolveAppearanceTheme } from '../src/renderer/src/composables/useAppearanceTheme'

describe('面板主题', () => {
  it('跟随系统时使用实时系统配色', () => {
    expect(resolveAppearanceTheme('system', false)).toBe('light')
    expect(resolveAppearanceTheme('system', true)).toBe('dark')
  })

  it('手动选择不受系统配色影响', () => {
    expect(resolveAppearanceTheme('light', true)).toBe('light')
    expect(resolveAppearanceTheme('dark', false)).toBe('dark')
  })
})
