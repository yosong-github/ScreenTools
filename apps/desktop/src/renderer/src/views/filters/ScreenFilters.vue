<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { ScreenFilterId, ScreenFilterState } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import FilterPreview from './FilterPreview.vue'

const props = defineProps<{
  state: ScreenFilterState | undefined
  locked: boolean
}>()

const filters: readonly { id: ScreenFilterId; label: string; icon: string }[] = [
  { id: 'off', label: '原色', icon: 'sun' },
  { id: 'reading', label: '阅读', icon: 'book' },
  { id: 'night', label: '夜间', icon: 'moon' },
  { id: 'grayscale', label: '灰度', icon: 'contrast' },
]
const controls = useControlsStore()
const previewFilter = shallowRef<ScreenFilterId>('reading')
const disabled = computed(() => props.locked || !props.state?.available)
const note = computed(() => {
  if (!props.state) return '正在检测系统能力…'
  if (!props.state.available) return props.state.reason ?? '当前系统不可用'
  return '作用于所有显示器，退出 ScreenTools 后恢复'
})

watch(
  () => props.state?.active,
  (active) => {
    if (active && active !== 'off') previewFilter.value = active
  },
  { immediate: true },
)

function applyFilter(filter: ScreenFilterId): void {
  previewFilter.value = filter
  if (disabled.value || props.state?.active === filter) return
  void controls.execute({ type: 'screen-filter', filter })
}
</script>

<template>
  <div class="filter-content">
    <div class="card scene-card">
      <div class="card-title">
        <PanelIcon name="contrast" /><strong>屏幕滤镜</strong><span>所有显示器</span>
      </div>
      <div class="scene-grid">
        <button
          v-for="filter in filters"
          :key="filter.id"
          class="scene-option"
          type="button"
          :disabled="disabled"
          :class="{
            chosen: state?.active === filter.id,
            previewing: previewFilter === filter.id && state?.active !== filter.id,
          }"
          :aria-pressed="state?.active === filter.id"
          @pointerenter="previewFilter = filter.id"
          @focus="previewFilter = filter.id"
          @click="applyFilter(filter.id)"
        >
          <PanelIcon :name="filter.icon" :size="22" />
          <span>{{ filter.label }}</span>
        </button>
      </div>
      <p class="card-note">{{ note }}</p>
    </div>
    <FilterPreview :filter="previewFilter" :active="state?.active ?? 'off'" />
  </div>
</template>

<style scoped>
.filter-content {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}
.filter-content::-webkit-scrollbar {
  display: none;
}
.scene-option.previewing {
  border-color: var(--accent-border);
}
</style>
