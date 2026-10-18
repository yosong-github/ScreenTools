<script setup lang="ts">
import { computed, onDeactivated, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { HardwareValue } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '../PanelIcon.vue'

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

function chooseSource(value: number): void {
  if (
    !switchingEnabled.value ||
    !props.deviceId ||
    props.locked ||
    value === props.capability?.current
  )
    return
  if (!window.confirm('切换输入源可能使屏幕断开，无法自动恢复。请确认可以用显示器实体按键恢复。'))
    return
  disableSwitching()
  void controls.execute({
    type: 'hardware',
    setting: { id: props.deviceId, feature: 'inputSource', value },
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
      <button
        v-for="value in sources"
        :key="value"
        type="button"
        :class="{ chosen: value === capability?.current }"
        :aria-pressed="value === capability?.current"
        :aria-label="`${sourceName(value)}${value === capability?.current ? '，当前输入源' : ''}`"
        :disabled="!switchingEnabled || locked || !deviceId || value === capability?.current"
        @click="chooseSource(value)"
      >
        <span>{{ sourceName(value) }}</span>
        <PanelIcon v-if="value === capability?.current" name="check" :size="13" />
      </button>
    </div>
    <p v-else class="card-note">
      {{ connection ?? '连接状态未知' }} ·
      {{ deviceId ? '当前设备未提供可切换的输入源' : '等待设备连接' }}
    </p>
  </div>
</template>

<style scoped>
.source-control {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #a3a2a0;
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
}
.source-control .switch {
  margin-left: 0;
}
.source-control:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}
.input-source-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 7px;
  margin-top: 10px;
}
.input-source-options button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  height: 34px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: #303233;
  color: #e6e5e3;
  font-size: 11px;
  font-weight: 600;
}
.input-source-options button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.input-source-options button svg {
  flex: none;
}
.input-source-options button:hover:not(:disabled):not(.chosen) {
  background: #3a3c3d;
}
.input-source-options button.chosen {
  border-color: #b85813;
  background: #4a2b1b;
  color: #ff8129;
}
.input-source-options button:disabled {
  opacity: 1;
  cursor: default;
}
@media (max-height: 760px) {
  .input-source-options {
    gap: 6px;
    margin-top: 7px;
  }
  .input-source-options button {
    height: 31px;
  }
}
</style>
