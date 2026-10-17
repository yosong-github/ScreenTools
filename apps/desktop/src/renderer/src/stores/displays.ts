import { computed, onScopeDispose, shallowRef } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { DisplaySnapshot } from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'

export const useDisplaysStore = defineStore('displays', () => {
  const snapshot = shallowRef<DisplaySnapshot | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const selectedId = shallowRef<string | null>(null)
  const displays = computed(() => snapshot.value?.displays ?? [])
  const selected = computed(
    () => displays.value.find((display) => display.id === selectedId.value) ?? null,
  )
  let unsubscribe: (() => void) | undefined
  let polling: ReturnType<typeof setInterval> | undefined
  let pending = false
  let generation = 0

  async function refresh(): Promise<void> {
    pending = true
    if (loading.value) return
    const currentGeneration = generation
    loading.value = true
    try {
      // 刷新期间收到新事件时再读一次，避免丢掉热插拔的最终状态。
      do {
        pending = false
        try {
          const next = await screenTools.getDisplaySnapshot()
          if (currentGeneration !== generation) return
          snapshot.value = next
          error.value = null
          if (!next.displays.some((display) => display.id === selectedId.value)) {
            selectedId.value =
              next.displays.find((display) => display.primary)?.id ?? next.displays[0]?.id ?? null
          }
        } catch {
          if (currentGeneration !== generation) return
          error.value = '无法读取显示器信息，请重试。已有数据为上次成功读取的状态。'
        }
      } while (pending && currentGeneration === generation)
    } finally {
      if (currentGeneration === generation) loading.value = false
    }
  }

  function start(): void {
    if (unsubscribe) return
    unsubscribe = screenTools.onDisplaysChanged(() => {
      void refresh()
    })
    // 部分驱动修改刷新率时不发送布局事件，低频同步补齐状态。
    polling = setInterval(() => {
      void refresh()
    }, 15000)
    void refresh()
  }

  function stop(): void {
    generation++
    unsubscribe?.()
    unsubscribe = undefined
    clearInterval(polling)
    loading.value = false
    pending = false
  }

  onScopeDispose(stop)
  return { snapshot, displays, selected, selectedId, loading, error, refresh, start, stop }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useDisplaysStore, import.meta.hot))
