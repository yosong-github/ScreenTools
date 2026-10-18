<script setup lang="ts">
import type { ChangePlan, HardwareCapabilities, NativeDisplay } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import { snapshotSettings } from '@renderer/utils/display-settings'
import HardwareSlider from '../hardware/HardwareSlider.vue'
import PanelIcon from '../PanelIcon.vue'
import ScenePresets from '../scenes/ScenePresets.vue'

defineOptions({ name: 'PictureSettingsPage' })

const props = defineProps<{
  selected: NativeDisplay | undefined
  devices: NativeDisplay[]
  capabilities: HardwareCapabilities
  locked: boolean
}>()

const controls = useControlsStore()
const topologies = {
  extend: '扩展',
  clone: '复制',
  internal: '仅主屏',
  external: '仅外屏',
} as const

function applyTopology(topology: NonNullable<ChangePlan['topology']>): void {
  void controls.execute({ type: 'apply', plan: { topology, displays: [], hardware: [] } })
}
function hdrChange(event: Event): void {
  if (props.locked) return
  const changes = snapshotSettings(props.devices)
  const target = changes.find((device) => device.id === props.selected?.id)
  if (!target) return
  target.hdrEnabled = (event.target as HTMLInputElement).checked
  void controls.execute({ type: 'apply', plan: { displays: changes, hardware: [] } })
}
</script>

<template>
  <section class="page-view">
    <div class="section-caption"><span>画面与配置</span><span>当前显示器</span></div>
    <div class="card compact-card">
      <div class="card-title">
        <PanelIcon name="layout" /><strong>显示拓扑</strong><span>20 秒确认</span>
      </div>
      <div class="choice-grid topology-grid">
        <button
          v-for="(name, key) in topologies"
          :key="key"
          :disabled="locked || !selected"
          @click="applyTopology(key)"
        >
          {{ name }}
        </button>
      </div>
    </div>
    <ScenePresets :device-id="selected?.id" :capabilities="capabilities" :locked="locked" />
    <HardwareSlider
      feature="brightness"
      :device-id="selected?.id"
      :capability="capabilities.brightness"
      :locked="locked"
      label="硬件亮度"
      input-label="硬件亮度"
      icon="sun"
      note="释放滑块时提交，设备响应可能需要数秒"
      unavailable-note="暂不可用，设备能力会自动更新。"
    />
    <HardwareSlider
      feature="contrast"
      :device-id="selected?.id"
      :capability="capabilities.contrast"
      :locked="locked"
      label="对比度"
      input-label="对比度"
      icon="contrast"
      note="显示器硬件对比度"
    />
    <div v-if="selected?.hdr?.supported" class="card toggle-card">
      <div class="card-title">
        <PanelIcon name="sparkles" /><strong>HDR / 高级颜色</strong>
        <span>{{ selected.hdr.enabled ? '已开启' : '已关闭' }}</span>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          :checked="selected.hdr.enabled"
          :disabled="locked"
          @change="hdrChange"
        />
        <span></span>
      </label>
    </div>
  </section>
</template>
