import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'
import { useHardwareSliderDraft } from './useHardwareSliderDraft'

type HardwareSliderDraft = ReturnType<typeof useHardwareSliderDraft>
const hardwareSliderDraftKey: InjectionKey<HardwareSliderDraft> = Symbol('hardwareSliderDraft')

export function provideHardwareSliderDraft(): void {
  provide(hardwareSliderDraftKey, useHardwareSliderDraft())
}

export function useSharedHardwareSliderDraft(): HardwareSliderDraft {
  const draft = inject(hardwareSliderDraftKey)
  if (!draft) throw new Error('HardwareSlider requires a tray panel')
  return draft
}
