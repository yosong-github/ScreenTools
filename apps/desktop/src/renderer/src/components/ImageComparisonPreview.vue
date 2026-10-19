<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import RangeSlider from '@renderer/components/RangeSlider.vue'

const props = defineProps<{
  image: string
  effect: string
  leftLabel: string
  rightLabel: string
}>()

const split = shallowRef(50)
const effectStyle = computed(() => ({
  clipPath: `inset(0 0 0 ${split.value}%)`,
  filter: props.effect,
}))
const dividerStyle = computed(() => ({ left: `${split.value}%` }))
const comparisonText = computed(
  () => `${props.leftLabel} ${split.value}%，${props.rightLabel} ${100 - split.value}%`,
)
</script>

<template>
  <div class="preview-stage">
    <img class="preview-image" :src="image" alt="" draggable="false" />
    <img
      class="preview-image preview-effect"
      :src="image"
      :style="effectStyle"
      alt=""
      draggable="false"
    />
    <span class="preview-side-label preview-side-label-left">{{ leftLabel }}</span>
    <span class="preview-side-label preview-side-label-right">{{ rightLabel }}</span>
    <RangeSlider
      v-model="split"
      class="preview-slider"
      :label="`拖动比较${leftLabel}和${rightLabel}效果`"
      :value-text="comparisonText"
    />
    <span class="preview-divider" :style="dividerStyle" aria-hidden="true">
      <span class="preview-handle">
        <PanelIcon name="chevron-left" :size="13" />
        <PanelIcon name="chevron-right" :size="13" />
      </span>
    </span>
  </div>
</template>

<style scoped>
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
</style>
