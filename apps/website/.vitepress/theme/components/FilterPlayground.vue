<script setup lang="ts">
import { computed, reactive, ref, useId } from 'vue'
import { withBase } from 'vitepress'
import {
  createCustomFilterMatrix,
  defaultCustomFilterSettings,
  getScreenFilterMatrix,
  toSvgColorMatrixValues,
} from '@screentools/display-core'

type PresetId =
  | 'off'
  | 'reading'
  | 'night'
  | 'grayscale'
  | 'fps-competitive'
  | 'fps-vivid'
  | 'fps-dark'
  | 'fps-focus'

interface FilterOption {
  id: PresetId
  label: string
  detail: string
}

const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  { compact: false },
)

const groups: readonly { label: string; filters: readonly FilterOption[] }[] = [
  {
    label: '日常',
    filters: [
      { id: 'off', label: '原色', detail: '恢复启用滤镜前的颜色' },
      { id: 'reading', label: '阅读', detail: '绿色降到 92%，蓝色降到 75%' },
      { id: 'night', label: '夜间', detail: '红色 82%、绿色 68%、蓝色 45%' },
      { id: 'grayscale', label: '灰度', detail: '按 Windows 文档中的灰度矩阵转为灰阶' },
    ],
  },
  {
    label: 'FPS 游戏',
    filters: [
      { id: 'fps-competitive', label: '竞技', detail: '适度增强对比与色彩' },
      { id: 'fps-vivid', label: '鲜艳', detail: '明显提高色彩饱和度' },
      { id: 'fps-dark', label: '暗场', detail: '提亮暗部，整体对比更柔和' },
      { id: 'fps-focus', label: '专注', detail: '适度降低饱和度，减少色彩干扰' },
    ],
  },
]

const channels: readonly {
  key: keyof typeof defaultCustomFilterSettings
  label: string
  min: number
  max: number
  step: number
  unit: string
}[] = [
  { key: 'brightness', label: '亮度', min: -50, max: 50, step: 1, unit: '%' },
  { key: 'contrast', label: '对比度', min: -50, max: 50, step: 1, unit: '%' },
  { key: 'temperature', label: '色温', min: 3000, max: 10000, step: 100, unit: 'K' },
  { key: 'blackLevel', label: '黑位', min: -20, max: 20, step: 1, unit: '%' },
  { key: 'red', label: '红色', min: 20, max: 200, step: 1, unit: '%' },
  { key: 'green', label: '绿色', min: 20, max: 200, step: 1, unit: '%' },
  { key: 'blue', label: '蓝色', min: 20, max: 200, step: 1, unit: '%' },
  { key: 'saturation', label: '饱和度', min: 0, max: 200, step: 1, unit: '%' },
]

const mode = ref<'presets' | 'custom'>('presets')
const activeId = ref<PresetId>('reading')
const split = ref(62)
const settings = reactive({ ...defaultCustomFilterSettings })
const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const filterId = `st-filter-${rawId}`
const clipId = `st-clip-${rawId}`
const previewSrc = withBase('/images/filter-preview.webp')
const clipX = computed(() => (split.value / 100) * 160)
const filterUrl = `url(#${filterId})`
const clipUrl = `url(#${clipId})`

const activePreset = computed(() =>
  groups.flatMap((group) => group.filters).find((filter) => filter.id === activeId.value)!,
)
const matrixValues = computed(() =>
  toSvgColorMatrixValues(
    mode.value === 'custom'
      ? createCustomFilterMatrix({ ...settings })
      : getScreenFilterMatrix(activeId.value),
  ),
)
const previewLabel = computed(() => (mode.value === 'custom' ? '自定义' : activePreset.value.label))
const previewDetail = computed(() =>
  mode.value === 'custom'
    ? '拖动滑块只更新这张预览。在应用里保存方案并点击后，才会作用到桌面。'
    : activePreset.value.detail,
)

function selectPreset(id: PresetId): void {
  mode.value = 'presets'
  activeId.value = id
}

function dragSplit(event: PointerEvent): void {
  if (event.type === 'pointermove' && event.buttons !== 1) return
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!bounds.width) return
  const ratio = (event.clientX - bounds.left) / bounds.width
  split.value = Math.min(94, Math.max(6, Math.round(ratio * 100)))
  if (event.type === 'pointerdown') {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
}

function resetCustom(): void {
  Object.assign(settings, defaultCustomFilterSettings)
}
</script>

<template>
  <div class="playground" :class="{ compact: props.compact }">
    <div v-if="!props.compact" class="mode-switch" role="group" aria-label="滤镜类型">
      <button type="button" :aria-pressed="mode === 'presets'" @click="mode = 'presets'">
        预设滤镜
      </button>
      <button type="button" :aria-pressed="mode === 'custom'" @click="mode = 'custom'">
        自定义滤镜
      </button>
    </div>

    <template v-if="mode === 'presets'">
      <section v-for="group in groups" :key="group.label" class="group">
        <h3>{{ group.label }}</h3>
        <div class="chips">
          <button
            v-for="filter in group.filters"
            :key="filter.id"
            type="button"
            :aria-pressed="activeId === filter.id"
            :title="filter.detail"
            @click="selectPreset(filter.id)"
          >
            {{ filter.label }}
          </button>
        </div>
      </section>
    </template>

    <div v-else class="sliders">
      <label v-for="channel in channels" :key="channel.key">
        <span>{{ channel.label }}</span>
        <input
          v-model.number="settings[channel.key]"
          type="range"
          :min="channel.min"
          :max="channel.max"
          :step="channel.step"
          :aria-label="channel.label"
        />
        <output>{{ settings[channel.key] }}{{ channel.unit }}</output>
      </label>
      <button class="reset" type="button" @click="resetCustom">重置参数</button>
    </div>

    <figure class="compare">
      <div
        class="frame"
        :style="{ '--split': `${split}%` }"
        @pointerdown="dragSplit"
        @pointermove="dragSplit"
      >
        <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" role="img">
          <title>用于对照滤镜的示例画面，左侧保持原色</title>
          <defs>
            <filter
              :id="filterId"
              :key="matrixValues"
              color-interpolation-filters="sRGB"
              x="0"
              y="0"
              width="100%"
              height="100%"
            >
              <feColorMatrix type="matrix" :values="matrixValues" />
            </filter>
            <clipPath :id="clipId">
              <rect :x="clipX" y="0" :width="160 - clipX" height="90" />
            </clipPath>
          </defs>
          <image :href="previewSrc" x="0" y="0" width="160" height="90" />
          <image
            :href="previewSrc"
            x="0"
            y="0"
            width="160"
            height="90"
            :filter="filterUrl"
            :clip-path="clipUrl"
          />
        </svg>
        <span class="side left">原色</span>
        <span class="side right">{{ previewLabel }}</span>
        <span class="divider" aria-hidden="true"><span class="handle"></span></span>
      </div>
      <input
        v-model.number="split"
        class="split-input"
        type="range"
        min="6"
        max="94"
        aria-label="拖动比较原色和滤镜效果"
        :aria-valuetext="`原色 ${split}%，${previewLabel} ${100 - split}%`"
      />
      <figcaption>
        <strong>{{ previewLabel }}</strong>
        {{ previewDetail }}
      </figcaption>
    </figure>
    <p class="footnote">
      预览使用与应用相同的颜色矩阵和示例画面。桌面上的效果会作用到所有显示器，这里不会。
    </p>
  </div>
</template>

<style scoped>
.playground {
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 88%, transparent);
  box-shadow: var(--st-shadow);
}

.mode-switch,
.chips {
  display: grid;
  gap: 8px;
}

.mode-switch {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 14px;
}

.mode-switch button,
.chips button,
.reset {
  border: 1px solid var(--vp-c-divider);
  background: color-mix(in srgb, var(--vp-c-bg) 70%, transparent);
  color: var(--vp-c-text-1);
  cursor: pointer;
}

.mode-switch button,
.reset {
  min-height: 36px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.mode-switch button[aria-pressed='true'],
.chips button[aria-pressed='true'] {
  border-color: #ff8129;
  background: #633310;
  color: #f6f1ea;
}

.group h3 {
  margin: 12px 0 8px;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.4;
}

.chips {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.chips button {
  min-height: 40px;
  border-radius: 12px;
  font-size: 13px;
}

.sliders {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.sliders label {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 64px;
  gap: 8px;
  align-items: center;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.sliders input {
  width: 100%;
  accent-color: #ef6208;
}

.sliders output {
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.reset {
  justify-self: start;
  padding: 0 14px;
}

.compare {
  position: relative;
  margin: 14px 0 0;
}

.frame {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  aspect-ratio: 16 / 9;
  background: #141210;
  cursor: ew-resize;
  touch-action: none;
}

.frame svg {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}

.side {
  position: absolute;
  top: 10px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(12, 10, 8, 0.72);
  color: white;
  font-size: 12px;
  line-height: 1.2;
}

.side.left {
  left: 10px;
}

.side.right {
  right: 10px;
}

.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--split, 62%);
  z-index: 2;
  width: 2px;
  background: white;
  transform: translateX(-1px);
  pointer-events: none;
}

.handle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  border: 2px solid #ff8129;
  border-radius: 50%;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
}

.split-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

figcaption,
.footnote {
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}

figcaption {
  margin-top: 10px;
}

figcaption strong {
  margin-right: 6px;
  color: var(--vp-c-text-1);
}

.footnote {
  margin: 8px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

@media (max-width: 720px) {
  .chips,
  .sliders label {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sliders label {
    grid-template-columns: 52px minmax(0, 1fr);
  }

  .sliders output {
    display: none;
  }
}
</style>
