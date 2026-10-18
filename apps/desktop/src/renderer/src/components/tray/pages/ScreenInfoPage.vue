<script setup lang="ts">
import { computed } from 'vue'
import type { DisplayDevice, HardwareCapabilities, NativeDisplay } from '@screentools/contracts'
import { formatPixelSize, formatRefreshRate } from '@renderer/utils/display-format'
import InputSourceCard from '../input-source/InputSourceCard.vue'
import HardwareSlider from '../hardware/HardwareSlider.vue'

defineOptions({ name: 'ScreenInfoPage' })

const props = defineProps<{
  selected: NativeDisplay | undefined
  display: DisplayDevice | undefined
  capabilities: HardwareCapabilities
  locked: boolean
}>()

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
    <InputSourceCard
      :device-id="selected?.id"
      :connection="selected?.connection"
      :capability="capabilities.inputSource"
      :locked="locked"
    />
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
