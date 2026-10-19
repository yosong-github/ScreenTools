<script setup lang="ts">
import { computed, useId } from 'vue'
import type { ScreenFilterId } from '@screentools/contracts'
import {
  getScreenFilterMatrix,
  screenFilterPresets,
  toSvgColorMatrixValues,
} from '@screentools/display-core'
import previewImage from '@renderer/assets/filter-preview.png'
import ImageComparisonPreview from '@renderer/components/ImageComparisonPreview.vue'

const props = defineProps<{
  filter: ScreenFilterId
  active: ScreenFilterId
}>()

const filterId = `screen-filter-preview-${useId()}`
const filterLabel = computed(
  () => screenFilterPresets.find((preset) => preset.id === props.filter)?.label ?? '原色',
)
const matrixValues = computed(() => toSvgColorMatrixValues(getScreenFilterMatrix(props.filter)))
</script>

<template>
  <div class="card preview-card">
    <div class="preview-heading">
      <strong>实时预览</strong>
      <span>{{ filterLabel }}</span>
    </div>
    <svg class="preview-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="filterId" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" :values="matrixValues" />
        </filter>
      </defs>
    </svg>
    <ImageComparisonPreview
      :image="previewImage"
      :effect="`url(#${filterId})`"
      left-label="原色"
      :right-label="filterLabel"
    />
    <p class="preview-note">
      {{
        active === 'off'
          ? '悬停上方预设可查看效果，拖动分界线比较画面。'
          : '全屏滤镜已启用，预览图也会受当前效果影响；切回原色可准确比较。'
      }}
    </p>
  </div>
</template>

<style scoped>
.preview-card {
  padding: 13px 14px 11px;
}
.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--text-strong);
  font-size: 12px;
}
.preview-heading span {
  color: var(--subtle);
  font-size: 11px;
}
.preview-filter-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
.preview-note {
  margin: 8px 1px 0;
  color: var(--subtle);
  font-size: 10px;
  line-height: 1.45;
}
</style>
