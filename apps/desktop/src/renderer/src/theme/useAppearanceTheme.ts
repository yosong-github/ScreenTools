import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import type { AppSettings } from '@screentools/contracts'

export function resolveAppearanceTheme(
  preference: AppSettings['theme'],
  systemDark: boolean,
): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

export function useAppearanceTheme(preference: Readonly<Ref<AppSettings['theme']>>): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => {
    document.documentElement.dataset.theme = resolveAppearanceTheme(preference.value, media.matches)
  }

  watch(preference, apply, { immediate: true })
  onMounted(() => media.addEventListener('change', apply))
  onUnmounted(() => media.removeEventListener('change', apply))
}
