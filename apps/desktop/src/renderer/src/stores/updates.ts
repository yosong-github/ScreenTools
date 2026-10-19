import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { UpdateState } from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'

export const useUpdatesStore = defineStore('updates', () => {
  const state = shallowRef<UpdateState | null>(null)
  const hasUpdate = computed(
    () =>
      !!state.value?.latestVersion &&
      ['available', 'downloading', 'ready', 'error'].includes(state.value.phase),
  )
  let unsubscribe: (() => void) | undefined
  let revision = 0

  function start(): void {
    if (unsubscribe) return
    unsubscribe = screenTools.onUpdateChanged((next) => {
      revision++
      state.value = next
    })
    const requestedAt = revision
    void screenTools.getUpdateState().then((next) => {
      if (revision === requestedAt) state.value = next
    })
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribe = undefined
  }

  async function check(): Promise<void> {
    state.value = await screenTools.checkForUpdates()
  }

  async function download(): Promise<void> {
    state.value = await screenTools.downloadUpdate()
  }

  async function install(): Promise<void> {
    await screenTools.installUpdate()
  }

  async function openReleasePage(): Promise<void> {
    await screenTools.openUpdatePage()
  }

  return { state, hasUpdate, start, stop, check, download, install, openReleasePage }
})
