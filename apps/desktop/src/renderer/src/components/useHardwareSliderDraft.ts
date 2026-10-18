import { shallowRef } from 'vue'

export type SliderFeature = 'brightness' | 'contrast' | 'volume'

export function useHardwareSliderDraft() {
  const draft = shallowRef<{
    deviceId: string
    values: Partial<Record<SliderFeature, number>>
  }>({ deviceId: '', values: {} })

  function current(deviceId: string, feature: SliderFeature, actual: number): number {
    return draft.value.deviceId === deviceId ? (draft.value.values[feature] ?? actual) : actual
  }

  function preview(deviceId: string, feature: SliderFeature, value: number): void {
    const values = draft.value.deviceId === deviceId ? draft.value.values : {}
    draft.value = { deviceId, values: { ...values, [feature]: value } }
  }

  function clear(deviceId: string, feature: SliderFeature, value: number): void {
    if (draft.value.deviceId !== deviceId || draft.value.values[feature] !== value) return
    const values = { ...draft.value.values }
    delete values[feature]
    draft.value = { deviceId, values }
  }

  async function commit(
    deviceId: string,
    feature: SliderFeature,
    value: number,
    write: () => Promise<boolean>,
  ): Promise<boolean> {
    preview(deviceId, feature, value)
    try {
      return await write()
    } finally {
      clear(deviceId, feature, value)
    }
  }

  return { current, preview, clear, commit }
}
