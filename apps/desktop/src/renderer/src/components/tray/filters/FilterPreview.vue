<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import type { ScreenFilterId } from '@screentools/contracts'
import {
  getScreenFilterMatrix,
  screenFilterPresets,
  toSvgColorMatrixValues,
} from '@screentools/display-core'
import previewImage from '@renderer/assets/filter-preview.png'
import PanelIcon from '../PanelIcon.vue'

const props = defineProps<{
  filter: ScreenFilterId
  active: ScreenFilterId
}>()

const split = shallowRef(50)
const filterId = `screen-filter-preview-${useId()}`
const filterLabel = computed(
  () => screenFilterPresets.find((preset) => preset.id === props.filter)?.label ?? '原色',
)
const matrixValues = computed(() => toSvgColorMatrixValues(getScreenFilterMatrix(props.filter)))
const effectStyle = computed(() => ({
  clipPath: `inset(0 0 0 ${split.value}%)`,
  filter: `url(#${filterId})`,
}))
const dividerStyle = computed(() => ({ left: `${split.value}%` }))
const comparisonText = computed(
  () => `原色 ${split.value}%，${filterLabel.value} ${100 - split.value}%`,
)
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
    <div class="preview-stage">
      <img class="preview-image" :src="previewImage" alt="" draggable="false" />
      <img
        class="preview-image preview-effect"
        :src="previewImage"
        :style="effectStyle"
        alt=""
        draggable="false"
      />
      <span class="preview-side-label preview-side-label-left">原色</span>
      <span class="preview-side-label preview-side-label-right">{{ filterLabel }}</span>
      <input
        v-model.number="split"
        class="preview-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        aria-label="拖动比较原色和滤镜效果"
        :aria-valuetext="comparisonText"
      />
      <span class="preview-divider" :style="dividerStyle" aria-hidden="true">
        <span class="preview-handle">
          <PanelIcon name="chevron-left" :size="13" />
          <PanelIcon name="chevron-right" :size="13" />
        </span>
      </span>
    </div>
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
.preview-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface-soft);
}
.preview-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
.preview-side-label {
  position: absolute;
  top: 9px;
  z-index: 2;
  padding: 4px 7px;
  border-radius: 6px;
  background: #111b;
  color: white;
  font-size: 10px;
  line-height: 1;
  pointer-events: none;
}
.preview-side-label-left {
  left: 9px;
}
.preview-side-label-right {
  right: 9px;
}
.preview-slider[type='range'] {
  position: absolute;
  inset: 0;
  z-index: 4;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  border: 0;
  background: transparent;
  cursor: ew-resize;
}
.preview-slider[type='range']::-webkit-slider-runnable-track {
  height: 100%;
  background: transparent;
}
.preview-slider[type='range']::-webkit-slider-thumb {
  width: 34px;
  height: 34px;
  appearance: none;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.preview-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  width: 2px;
  transform: translateX(-50%);
  background: white;
  box-shadow: 0 0 6px #0008;
  pointer-events: none;
}
.preview-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  transform: translate(-50%, -50%);
  border: 2px solid white;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  box-shadow: 0 2px 9px #0008;
}
.preview-slider:focus-visible ~ .preview-divider .preview-handle {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.preview-note {
  margin: 8px 1px 0;
  color: var(--subtle);
  font-size: 10px;
  line-height: 1.45;
}
</style>
