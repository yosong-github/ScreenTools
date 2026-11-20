import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type {
  EnhanceCrop,
  EnhancePreset,
  EnhanceState,
  EnhanceWindow,
  EnhanceWindowSnapshot,
} from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'

export const useEnhanceStore = defineStore('enhance', () => {
  const state = shallowRef<EnhanceState | null>(null)
  const windows = shallowRef<EnhanceWindow[]>([])
  const crops = shallowRef<Record<number, EnhanceCrop>>({})
  const windowLoading = shallowRef(false)
  const available = computed(() => state.value?.component.available ?? false)
  const playing = computed(() => !!state.value?.playback)
  const windowActive = computed(() => state.value?.windowCapture.active ?? false)
  const windowPaused = computed(
    () => windowActive.value && state.value?.windowCapture.visible === false,
  )
  const preset = computed<EnhancePreset>(() => state.value?.settings.preset ?? 'auto')
  let unsubscribe: (() => void) | undefined
  let revision = 0

  function start(): void {
    if (unsubscribe) return
    unsubscribe = screenTools.onEnhanceChanged((next) => {
      revision++
      state.value = next
    })
    const requestedAt = revision
    void screenTools.getEnhanceState().then((next) => {
      if (revision === requestedAt) state.value = next
    })
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribe = undefined
  }

  async function refreshWindows(): Promise<void> {
    windowLoading.value = true
    try {
      windows.value = await screenTools.listEnhanceWindows()
    } finally {
      windowLoading.value = false
    }
  }

  async function captureSnapshot(hwnd: number): Promise<EnhanceWindowSnapshot | null> {
    return screenTools.captureEnhanceWindow(hwnd)
  }

  async function startWindow(target: EnhanceWindow): Promise<void> {
    state.value = await screenTools.startEnhanceWindow(target, crops.value[target.hwnd])
  }

  function setCrop(hwnd: number, crop: EnhanceCrop): void {
    crops.value = { ...crops.value, [hwnd]: crop }
  }

  function clearCrop(hwnd: number): void {
    const next = { ...crops.value }
    delete next[hwnd]
    crops.value = next
  }

  async function toggleWindow(): Promise<void> {
    state.value = await screenTools.toggleEnhanceWindow()
  }

  async function stopWindow(): Promise<void> {
    state.value = await screenTools.stopEnhanceWindow()
  }

  async function chooseComponent(): Promise<void> {
    state.value = await screenTools.chooseEnhanceComponent()
  }

  async function openVideo(file?: string): Promise<void> {
    state.value = await screenTools.openEnhanceVideo(file)
  }

  async function stopPlayback(): Promise<void> {
    state.value = await screenTools.stopEnhancePlayback()
  }

  async function setPreset(next: EnhancePreset): Promise<void> {
    state.value = await screenTools.setEnhancePreset(next)
  }

  return {
    state,
    windows,
    crops,
    windowLoading,
    available,
    playing,
    windowActive,
    windowPaused,
    preset,
    start,
    stop,
    refreshWindows,
    captureSnapshot,
    setCrop,
    clearCrop,
    startWindow,
    toggleWindow,
    stopWindow,
    chooseComponent,
    openVideo,
    stopPlayback,
    setPreset,
  }
})
