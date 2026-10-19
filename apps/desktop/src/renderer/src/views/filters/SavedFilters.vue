<script setup lang="ts">
import { useId } from 'vue'
import type { CustomScreenFilter } from '@screentools/contracts'
import { createCustomFilterMatrix, toSvgColorMatrixValues } from '@screentools/display-core'
import previewImage from '@renderer/assets/filter-preview.png'
import ChoiceButton from '@renderer/components/ChoiceButton.vue'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import { useControlsStore } from '@renderer/stores/controls'

const props = defineProps<{
  filters: CustomScreenFilter[]
  activeId: string | null
  previewId: string | null
  disabled: boolean
  canApply: boolean
}>()

const emit = defineEmits<{
  preview: [filter: CustomScreenFilter]
}>()

const controls = useControlsStore()
const filterPrefix = `saved-filter-${useId()}`

function filterId(id: string): string {
  return `${filterPrefix}-${id}`
}

function apply(filter: CustomScreenFilter): void {
  if (props.disabled || !props.canApply || filter.id === props.activeId) return
  void controls.execute({ type: 'apply-custom-filter', id: filter.id })
}

function remove(filter: CustomScreenFilter): void {
  if (props.disabled || filter.id === props.activeId) return
  void controls.execute({ type: 'delete-custom-filter', id: filter.id })
}
</script>

<template>
  <div class="card saved-filters-card">
    <div class="card-title">
      <PanelIcon name="sparkles" /><strong>我的滤镜</strong><span>{{ filters.length }} 个方案</span>
    </div>
    <template v-if="filters.length">
      <svg class="saved-filter-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter
            v-for="filter in filters"
            :id="filterId(filter.id)"
            :key="filter.id"
            color-interpolation-filters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              :values="toSvgColorMatrixValues(createCustomFilterMatrix(filter.settings))"
            />
          </filter>
        </defs>
      </svg>
      <div
        class="scene-grid saved-filters-grid"
        :style="{ '--saved-columns': Math.min(4, Math.max(2, filters.length)) }"
      >
        <div v-for="filter in filters" :key="filter.id" class="saved-filter">
          <ChoiceButton
            variant="scene"
            :disabled="disabled || !canApply"
            :pressed="filter.id === activeId"
            :class="{ previewing: previewId === filter.id && activeId !== filter.id }"
            :aria-label="filter.id === activeId ? `${filter.name}，使用中` : `应用${filter.name}`"
            :title="filter.name"
            @pointerenter="emit('preview', filter)"
            @focus="emit('preview', filter)"
            @click="apply(filter)"
          >
            <span class="saved-filter-thumb">
              <img :src="previewImage" alt="" :style="{ filter: `url(#${filterId(filter.id)})` }" />
            </span>
            <span class="saved-filter-name">{{ filter.name }}</span>
          </ChoiceButton>
          <span v-if="filter.id === activeId" class="saved-filter-badge">使用中</span>
          <span v-else-if="filter.id === previewId" class="saved-filter-badge">预览</span>
          <button
            class="saved-filter-delete"
            type="button"
            :disabled="disabled || filter.id === activeId"
            :aria-label="`删除${filter.name}`"
            :title="filter.id === activeId ? '先切回原色再删除' : `删除${filter.name}`"
            @click="remove(filter)"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </template>
    <p v-else class="card-note">还没有保存的滤镜方案，可在下方调节并保存。</p>
  </div>
</template>

<style scoped>
.saved-filter-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
.saved-filters-grid {
  grid-template-columns: repeat(var(--saved-columns), minmax(0, 1fr));
  margin-top: 11px;
}
.saved-filter {
  position: relative;
  min-width: 0;
}
.saved-filter .scene-option {
  width: 100%;
  height: 96px;
  gap: 0;
  padding: 0;
  overflow: hidden;
}
.saved-filter .scene-option.previewing {
  border-color: var(--accent-border);
}
.saved-filter-thumb {
  display: block;
  width: 100%;
  height: 69px;
  overflow: hidden;
}
.saved-filter-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.saved-filter-name {
  display: block;
  width: 100%;
  padding: 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 25px;
}
.saved-filter-badge {
  position: absolute;
  top: 7px;
  left: 7px;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-strong);
  font-size: 9px;
  line-height: 1.2;
  pointer-events: none;
}
.saved-filter-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
  color: var(--text-strong);
  backdrop-filter: blur(6px);
}
.saved-filter-delete svg {
  width: 12px;
  height: 12px;
}
.saved-filter-delete:hover:not(:disabled) {
  border-color: var(--error-border);
  background: var(--error-bg);
  color: var(--error-text);
}
</style>
