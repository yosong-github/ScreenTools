<script setup lang="ts">
import { computed, onDeactivated, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { HardwareValue } from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import ChoiceButton from '@renderer/components/ChoiceButton.vue'

const props = defineProps<{
  deviceId: string | undefined
  connection: string | undefined
  capability: HardwareValue | undefined
  locked: boolean
}>()

const controls = useControlsStore()
const sources = computed(() => [...new Set(props.capability?.values ?? [])])
const switchingEnabled = shallowRef(false)

function disableSwitching(): void {
  switchingEnabled.value = false
}

watch(() => props.deviceId, disableSwitching)
watch(
  () => sources.value.length,
  (count) => {
    if (!count) disableSwitching()
  },
)
onDeactivated(disableSwitching)
onMounted(() => window.addEventListener('blur', disableSwitching))
onUnmounted(() => window.removeEventListener('blur', disableSwitching))

function sourceName(value: number): string {
  return (
    ({ 0x0f: 'DP 1', 0x10: 'DP 2', 0x11: 'HDMI 1', 0x12: 'HDMI 2' } as Record<number, string>)[
      value
    ] ?? `VCP 0x${value.toString(16).toUpperCase()}`
  )
}

async function chooseSource(value: number): Promise<void> {
  const deviceId = props.deviceId
  if (!switchingEnabled.value || !deviceId || props.locked || value === props.capability?.current)
    return
  if (!(await screenTools.confirmInputSourceSwitch())) return
  if (props.deviceId !== deviceId || props.locked || value === props.capability?.current) return
  disableSwitching()
  void controls.execute({
    type: 'hardware',
    setting: { id: deviceId, feature: 'inputSource', value },
  })
}
</script>

<template>
  <div class="card input-card">
    <div class="card-title">
      <PanelIcon name="cable" /><strong>输入源</strong>
      <span>{{ capability ? sourceName(capability.current) : (connection ?? '—') }}</span>
      <label class="source-control">
        <span>允许切换</span>
        <span class="switch">
          <input
            v-model="switchingEnabled"
            type="checkbox"
            :disabled="locked || !deviceId || !sources.length"
          />
          <span></span>
        </span>
      </label>
    </div>
    <div v-if="sources.length" class="input-source-options" role="group" aria-label="选择输入源">
      <ChoiceButton
        v-for="value in sources"
        :key="value"
        variant="source"
        :pressed="value === capability?.current"
        :aria-label="`${sourceName(value)}${value === capability?.current ? '，当前输入源' : ''}`"
        :disabled="!switchingEnabled || locked || !deviceId || value === capability?.current"
        @click="chooseSource(value)"
      >
        <span class="truncate">{{ sourceName(value) }}</span>
        <PanelIcon v-if="value === capability?.current" name="check" :size="13" />
      </ChoiceButton>
    </div>
    <p v-else class="card-note">
      {{ connection ?? '连接状态未知' }} ·
      {{ deviceId ? '当前设备未提供可切换的输入源' : '等待设备连接' }}
    </p>
  </div>
</template>
