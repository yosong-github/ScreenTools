<script setup lang="ts">
import { computed } from 'vue'
import type { DisplayDevice, HardwareCapabilities, NativeDisplay } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import { formatPixelSize, formatRefreshRate } from '@renderer/utils/display-format'
import HardwareSlider from '../hardware/HardwareSlider.vue'
import PanelIcon from '../PanelIcon.vue'

defineOptions({ name: 'ScreenInfoPage' })

const props = defineProps<{
  selected: NativeDisplay | undefined
  display: DisplayDevice | undefined
  capabilities: HardwareCapabilities
  locked: boolean
}>()

const controls = useControlsStore()
const sizeText = computed(() =>
  props.selected
    ? formatPixelSize(props.selected.mode.width, props.selected.mode.height)
    : props.display
      ? formatPixelSize(props.display.pixelSize.width, props.display.pixelSize.height)
      : '—',
)
const currentRate = computed(
  () => props.selected?.mode.refreshRate ?? props.display?.refreshRate ?? null,
)

function sourceName(value: number): string {
  return (
    ({ 0x0f: 'DP 1', 0x10: 'DP 2', 0x11: 'HDMI 1', 0x12: 'HDMI 2' } as Record<number, string>)[
      value
    ] ?? `VCP 0x${value.toString(16).toUpperCase()}`
  )
}
function sourceChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  if (
    !props.selected ||
    props.locked ||
    !window.confirm('切换输入源可能使屏幕断开，无法自动恢复。请确认可以用显示器实体按键恢复。')
  ) {
    select.value = String(props.capabilities.inputSource?.current ?? '')
    return
  }
  void controls.execute({
    type: 'hardware',
    setting: { id: props.selected.id, feature: 'inputSource', value: Number(select.value) },
  })
}
</script>

<template>
  <section class="page-view">
    <div class="monitor-preview">
      <div class="monitor-screen">
        <strong>{{ sizeText }}</strong>
        <span>
          {{ currentRate === null ? '刷新率未知' : `${formatRefreshRate(currentRate)} Hz` }} ·
          {{ selected?.primary ? '主显示器' : '活动显示器' }}
        </span>
      </div>
      <span class="monitor-stem"></span><span class="monitor-foot"></span>
    </div>
    <div class="signal-line">
      <span><i></i>当前画面</span><strong>{{ selected?.connection ?? '系统显示' }}</strong>
    </div>
    <div class="card input-card">
      <div class="card-title">
        <PanelIcon name="cable" /><strong>输入源</strong>
        <span>{{ selected?.connection ?? '—' }}</span>
      </div>
      <select
        v-if="capabilities.inputSource?.values?.length"
        class="source-select"
        :value="capabilities.inputSource.current"
        :disabled="locked"
        @change="sourceChange"
      >
        <option v-for="value in capabilities.inputSource.values" :key="value" :value="value">
          {{ sourceName(value) }}{{ value === capabilities.inputSource.current ? ' · 当前' : '' }}
        </option>
      </select>
      <p v-else class="card-note">
        {{ selected?.connection ?? '连接状态未知' }} ·
        {{ selected ? '当前设备未提供可切换的输入源' : '等待设备连接' }}
      </p>
    </div>
    <HardwareSlider
      feature="brightness"
      :device-id="selected?.id"
      :capability="capabilities.brightness"
      :locked="locked"
      label="亮度"
      input-label="亮度"
      icon="sun"
      note="显示器硬件亮度 · DDC/CI"
      unavailable-note="暂不可用，设备能力会自动更新。"
    />
    <HardwareSlider
      feature="volume"
      :device-id="selected?.id"
      :capability="capabilities.volume"
      :locked="locked"
      label="显示器音量"
      input-label="显示器音量"
      icon="volume"
      :note="capabilities.volume ? '显示器内置音量' : '当前设备未提供可控音量'"
    />
  </section>
</template>
