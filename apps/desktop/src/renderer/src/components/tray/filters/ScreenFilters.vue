<script setup lang="ts">
import { computed } from 'vue'
import type { ScreenFilterId, ScreenFilterState } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '../PanelIcon.vue'

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
const disabled = computed(() => props.locked || !props.state?.available)
const note = computed(() => {
  if (!props.state) return '正在检测系统能力…'
  if (!props.state.available) return props.state.reason ?? '当前系统不可用'
  return '作用于所有显示器，退出 ScreenTools 后恢复'
})

function applyFilter(filter: ScreenFilterId): void {
  if (disabled.value || props.state?.active === filter) return
  void controls.execute({ type: 'screen-filter', filter })
}
</script>

<template>
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
        :class="{ chosen: state?.active === filter.id }"
        :aria-pressed="state?.active === filter.id"
        @click="applyFilter(filter.id)"
      >
        <PanelIcon :name="filter.icon" :size="22" />
        <span>{{ filter.label }}</span>
      </button>
    </div>
    <p class="card-note">{{ note }}</p>
  </div>
</template>
