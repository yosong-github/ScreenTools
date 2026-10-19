<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { CustomFilterSettings, CustomScreenFilter } from '@screentools/contracts'
import { defaultCustomFilterSettings } from '@screentools/display-core'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import RangeSlider from '@renderer/components/RangeSlider.vue'
import { useControlsStore } from '@renderer/stores/controls'

const props = defineProps<{
  filters: CustomScreenFilter[]
  activeId: string | null
  disabled: boolean
}>()

const emit = defineEmits<{
  preview: [settings: CustomFilterSettings, label: string]
}>()

const controls = useControlsStore()
const name = ref('')
const settings = reactive<CustomFilterSettings>({
  ...defaultCustomFilterSettings,
  ...props.filters.find((filter) => filter.id === props.activeId)?.settings,
})
watch(
  () => props.activeId,
  (id) => {
    const active = props.filters.find((filter) => filter.id === id)
    if (active) Object.assign(settings, active.settings)
  },
)
const channels: {
  key: keyof CustomFilterSettings
  label: string
  min: number
  max: number
  step?: number
  unit: string
  color?: string
}[] = [
  { key: 'brightness', label: '亮度', min: -50, max: 50, unit: '%' },
  { key: 'contrast', label: '对比度', min: -50, max: 50, unit: '%' },
  { key: 'temperature', label: '色温', min: 3000, max: 10000, step: 100, unit: 'K' },
  { key: 'blackLevel', label: '黑位', min: -20, max: 20, unit: '%' },
  { key: 'red', label: '红色', min: 20, max: 200, unit: '%', color: '#e74f50' },
  { key: 'green', label: '绿色', min: 20, max: 200, unit: '%', color: '#36b76a' },
  { key: 'blue', label: '蓝色', min: 20, max: 200, unit: '%', color: '#438ded' },
  { key: 'saturation', label: '饱和度', min: 0, max: 200, unit: '%' },
]

function preview(): void {
  emit('preview', { ...settings }, name.value.trim() || '自定义')
}

function update(key: keyof CustomFilterSettings, value: number): void {
  settings[key] = value
  preview()
}

function reset(): void {
  Object.assign(settings, defaultCustomFilterSettings)
  preview()
}

async function save(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed || props.disabled || props.filters.length >= 20) return
  await controls.execute({ type: 'save-custom-filter', name: trimmed, settings: { ...settings } })
}
</script>

<template>
  <div class="card custom-filter-card">
    <div class="card-title">
      <PanelIcon name="sliders" /><strong>自定义滤镜</strong>
      <button class="custom-reset" type="button" @click="reset">重置参数</button>
    </div>
    <p class="card-note">拖动滑块可立即预览；保存方案后可应用到所有显示器。</p>
    <div class="custom-controls">
      <label v-for="channel in channels" :key="channel.key" class="custom-control">
        <span>{{ channel.label }}</span>
        <RangeSlider
          :model-value="settings[channel.key]"
          :label="channel.label"
          :min="channel.min"
          :max="channel.max"
          :step="channel.step ?? 1"
          :class="{ 'temperature-range': channel.key === 'temperature' }"
          :style="{
            '--fill': `${((settings[channel.key] - channel.min) / (channel.max - channel.min)) * 100}%`,
            '--range-fill': channel.color,
            '--range-thumb': channel.color,
          }"
          @update:model-value="update(channel.key, $event)"
        />
        <output>{{ settings[channel.key] }}{{ channel.unit }}</output>
      </label>
    </div>
    <form class="custom-save" @submit.prevent="save">
      <input
        v-model="name"
        type="text"
        maxlength="40"
        placeholder="方案名称"
        aria-label="自定义滤镜方案名称"
        @input="preview"
      />
      <button
        class="primary-action"
        type="submit"
        :disabled="disabled || !name.trim() || filters.length >= 20"
      >
        保存方案
      </button>
    </form>
  </div>
</template>

<style scoped>
.custom-reset {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-soft);
  color: var(--text);
  font-size: 10px;
}
.custom-controls {
  display: grid;
  gap: 11px;
  margin-top: 14px;
}
.custom-control {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11px;
}
.custom-control output {
  color: var(--text-strong);
  text-align: right;
}
.temperature-range[type='range'] {
  background: linear-gradient(to right, #ffad6b, #f1e9d9 47%, #a5c9ff);
}
.custom-save {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}
.custom-save input {
  flex: 1;
  min-width: 0;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--text);
  font-size: 11px;
}
.custom-save button {
  flex: none;
  padding-inline: 14px;
}
</style>
