<script setup lang="ts">
import { computed } from 'vue'
import type { HardwareCapabilities } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '../PanelIcon.vue'
import {
  sceneHardwareSettings,
  sceneMatches,
  scenePresets,
  type ScenePreset,
} from './scene-presets'

const props = defineProps<{
  deviceId: string | undefined
  capabilities: HardwareCapabilities
  locked: boolean
}>()

const controls = useControlsStore()
const supportedSettings = computed(() =>
  sceneHardwareSettings(props.deviceId ?? '', props.capabilities, scenePresets[0]!),
)
const hasBrightness = computed(() =>
  supportedSettings.value.some(({ feature }) => feature === 'brightness'),
)
const hasContrast = computed(() =>
  supportedSettings.value.some(({ feature }) => feature === 'contrast'),
)
const available = computed(() => supportedSettings.value.length > 0)
const subtitle = computed(() => {
  if (hasBrightness.value && hasContrast.value) return '亮度 + 对比度'
  if (hasBrightness.value) return '硬件亮度'
  if (hasContrast.value) return '硬件对比度'
  return '当前设备不可用'
})

function description(scene: ScenePreset): string {
  return sceneHardwareSettings(props.deviceId ?? '', props.capabilities, scene)
    .map(({ feature, value }) => `${feature === 'brightness' ? '亮度' : '对比度'} ${value}%`)
    .join(' · ')
}

function applyScene(scene: ScenePreset): void {
  if (props.locked) return
  const hardware = sceneHardwareSettings(props.deviceId ?? '', props.capabilities, scene)
  if (!hardware.length) return
  void controls.execute({ type: 'apply', plan: { displays: [], hardware } })
}
</script>

<template>
  <div class="card scene-card">
    <div class="card-title">
      <PanelIcon name="sparkles" /><strong>场景</strong><span>{{ subtitle }}</span>
    </div>
    <div class="scene-grid">
      <button
        v-for="scene in scenePresets"
        :key="scene.id"
        class="scene-option"
        type="button"
        :disabled="locked || !available"
        :class="{ chosen: sceneMatches(capabilities, scene) }"
        :aria-pressed="sceneMatches(capabilities, scene)"
        :aria-label="`${scene.label}${description(scene) ? `，${description(scene)}` : ''}`"
        :title="description(scene) || '当前显示器不支持场景调节'"
        @click="applyScene(scene)"
      >
        <PanelIcon :name="scene.icon" :size="22" />
        <span>{{ scene.label }}</span>
      </button>
    </div>
  </div>
</template>
