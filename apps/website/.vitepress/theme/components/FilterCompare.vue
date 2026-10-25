<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import ColorScene from './ColorScene.vue'
import { filterGroups, svgMatrix, type FilterId } from '../filters'

const active = ref<FilterId>('reading')
const split = ref(62)
const filterId = `compare-${useId()}`
const matrix = computed(() => svgMatrix(active.value))
const activeLabel = computed(
  () =>
    filterGroups.flatMap((group) => group.items).find((item) => item.id === active.value)?.label ??
    '',
)

function select(id: FilterId): void {
  active.value = id
}
</script>

<template>
  <div class="st-compare">
    <svg class="st-compare-defs" aria-hidden="true">
      <defs>
        <filter :id="filterId" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" :values="matrix" />
        </filter>
      </defs>
    </svg>
    <div class="st-compare-stage">
      <ColorScene />
      <div
        class="st-compare-effect"
        :style="{ clipPath: `inset(0 0 0 ${split}%)`, filter: `url(#${filterId})` }"
      >
        <ColorScene />
      </div>
      <span class="st-compare-tag st-compare-tag-left">原色</span>
      <span class="st-compare-tag st-compare-tag-right">{{ activeLabel }}</span>
      <span class="st-compare-divider" :style="{ left: `${split}%` }" aria-hidden="true"></span>
      <input
        v-model.number="split"
        class="st-compare-range"
        type="range"
        min="0"
        max="100"
        aria-label="拖动比较原色和滤镜效果"
      />
    </div>
    <div class="st-compare-presets" role="group" aria-label="预览预设">
      <template v-for="group in filterGroups" :key="group.label">
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          :class="{ 'is-active': item.id === active }"
          :aria-pressed="item.id === active"
          @click="select(item.id)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
    <p class="st-compare-note">
      示意图使用与应用相同的颜色矩阵。拖动分界线，或聚焦后用方向键移动。
    </p>
  </div>
</template>

<style scoped>
.st-compare-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.st-compare-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg-sunken);
}

.st-compare-effect {
  position: absolute;
  inset: 0;
}

.st-compare-tag {
  position: absolute;
  top: 12px;
  z-index: 2;
  padding: 4px 8px;
  background: #111214cc;
  color: #f4f1ea;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  pointer-events: none;
}

.st-compare-tag-left {
  left: 12px;
}

.st-compare-tag-right {
  right: 12px;
}

.st-compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 1px;
  background: #fff;
  box-shadow: 0 0 0 1px #11121455;
  pointer-events: none;
}

.st-compare-range {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
}

.st-compare-stage:focus-within .st-compare-divider {
  box-shadow:
    0 0 0 1px #11121455,
    0 0 0 3px var(--accent);
}

.st-compare-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  background: var(--line);
  border-top: 1px solid var(--line);
}

.st-compare-presets button {
  flex: 1 1 80px;
  min-height: 40px;
  padding: 8px 10px;
  border: 0;
  background: var(--bg);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.st-compare-presets button.is-active,
.st-compare-presets button:hover {
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-compare-note {
  margin: 0;
  padding: 12px 16px 0;
  color: var(--faint);
  font-size: 13px;
  line-height: 1.6;
}
</style>
