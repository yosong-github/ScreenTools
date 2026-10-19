<script setup lang="ts">
import { computed } from 'vue'
import type { HardwareValue } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import { useSharedHardwareSliderDraft } from './hardware-slider-context'
import type { SliderFeature } from './useHardwareSliderDraft'

const props = defineProps<{
  feature: SliderFeature
  deviceId: string | undefined
  capability: HardwareValue | undefined
  locked: boolean
  label: string
  inputLabel: string
  icon: string
  note: string
  unavailableNote?: string
}>()

const controls = useControlsStore()
const draft = useSharedHardwareSliderDraft()
const actual = computed(() =>
  props.capability && props.capability.max > props.capability.min
    ? Math.round(
        ((props.capability.current - props.capability.min) * 100) /
          (props.capability.max - props.capability.min),
      )
    : 0,
)
const value = computed(() => draft.current(props.deviceId ?? '', props.feature, actual.value))

async function commit(next: number): Promise<void> {
  const deviceId = props.deviceId
  if (!deviceId) return
  if (props.locked) {
    draft.clear(deviceId, props.feature, next)
    return
  }
  await draft.commit(deviceId, props.feature, next, () =>
    controls.execute({
      type: 'hardware',
      setting: { id: deviceId, feature: props.feature, value: next },
    }),
  )
}
function bump(delta: -1 | 1): void {
  if (props.capability) void commit(Math.max(0, Math.min(100, value.value + delta)))
}
function preview(event: Event): void {
  if (props.deviceId)
    draft.preview(props.deviceId, props.feature, Number((event.target as HTMLInputElement).value))
}
function change(event: Event): void {
  void commit(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="card slider-card">
    <div class="card-title">
      <PanelIcon :name="icon" /><strong>{{ label }}</strong>
      <span class="value card-value">{{ capability ? value : '—' }}</span>
    </div>
    <p class="card-note">{{ note }}</p>
    <div v-if="capability" class="slider-row">
      <button
        class="slider-step"
        :aria-label="`降低${inputLabel}`"
        :disabled="locked"
        @click="bump(-1)"
      >
        <PanelIcon name="minus" :size="16" />
      </button>
      <input
        :value="value"
        :aria-label="inputLabel"
        type="range"
        min="0"
        max="100"
        :disabled="locked"
        :style="{ '--fill': `${value}%` }"
        @input="preview"
        @change="change"
      />
      <button
        class="slider-step"
        :aria-label="`提高${inputLabel}`"
        :disabled="locked"
        @click="bump(1)"
      >
        <PanelIcon name="plus" :size="16" />
      </button>
    </div>
    <p v-else-if="unavailableNote" class="card-note">{{ unavailableNote }}</p>
  </div>
</template>
