import { shallowRef, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ControlCommand, ControlState } from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'

export const useControlsStore = defineStore('controls', () => {
  const state = shallowRef<ControlState | null>(null)
  const busy = ref(false)
  const error = ref('')
  let unsubscribe: (() => void) | undefined
  let generation = 0
  let revision = 0
  async function read(): Promise<void> {
    const current = generation
    const request = ++revision
    try {
      const result = await screenTools.getControlState()
      if (current === generation && request === revision) state.value = result
    } catch (cause) {
      if (current === generation) error.value = String(cause)
    }
  }
  async function execute(command: ControlCommand): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    const current = generation
    try {
      const result = await screenTools.executeControl(command)
      if (current === generation) {
        // 命令返回的就是最新缓存状态，不再为每次操作补一次读取。
        revision++
        state.value = result
      }
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      await read()
      return false
    } finally {
      busy.value = false
    }
  }
  function start(): void {
    if (unsubscribe) return
    unsubscribe = screenTools.onControlChanged(() => {
      if (!busy.value) void read()
    })
    void read()
  }
  function stop(): void {
    generation++
    unsubscribe?.()
    unsubscribe = undefined
  }
  return { state, busy, error, execute, start, stop }
})
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useControlsStore, import.meta.hot))
