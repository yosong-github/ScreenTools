<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { DisplayMode } from '@screentools/contracts'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import { useTraySession } from '@renderer/composables/useTraySession'
import { useControlsStore } from '@renderer/stores/controls'
import { formatPixelSize, formatRefreshRate } from '@renderer/utils/display-format'
import { snapshotSettings } from '@renderer/utils/display-settings'

defineOptions({ name: 'DisplayModesView' })

type Resolution = { width: number; height: number }
const { selected, devices, display, scaleText, locked } = useTraySession()
const controls = useControlsStore()
const refreshPage = shallowRef(0)
const sizeText = computed(() =>
  selected.value
    ? formatPixelSize(selected.value.mode.width, selected.value.mode.height)
    : display.value
      ? formatPixelSize(display.value.pixelSize.width, display.value.pixelSize.height)
      : '—',
)
const currentRate = computed(
  () => selected.value?.mode.refreshRate ?? display.value?.refreshRate ?? null,
)
const resolutions = computed<Resolution[]>(() => {
  const items = new Map<string, Resolution>()
  for (const mode of selected.value?.modes ?? [])
    items.set(`${mode.width}x${mode.height}`, { width: mode.width, height: mode.height })
  return [...items.values()].sort(
    (a, b) => b.width * b.height - a.width * a.height || b.width - a.width,
  )
})
const refreshRates = computed(() => {
  const current = selected.value?.mode
  if (!current) return []
  return [
    ...new Set(
      selected.value?.modes
        .filter((mode) => mode.width === current.width && mode.height === current.height)
        .map((mode) => Number(mode.refreshRate.toFixed(2))) ?? [],
    ),
  ].sort((a, b) => b - a)
})
const refreshPages = computed(() => Math.max(1, Math.ceil(refreshRates.value.length / 8)))
const shownRates = computed(() =>
  refreshRates.value.slice(refreshPage.value * 8, refreshPage.value * 8 + 8),
)

function applyMode(mode: DisplayMode): void {
  if (locked.value) return
  const changes = snapshotSettings(devices.value)
  const target = changes.find((device) => device.id === selected.value?.id)
  if (!target) return
  target.mode = { ...mode }
  void controls.execute({ type: 'apply', plan: { displays: changes, hardware: [] } })
}
function applyRate(rate: number): void {
  const current = selected.value?.mode
  const mode = selected.value?.modes.find(
    (candidate) =>
      candidate.width === current?.width &&
      candidate.height === current.height &&
      Math.abs(candidate.refreshRate - rate) < 0.02,
  )
  if (mode) applyMode(mode)
}
function applyResolution(resolution: Resolution): void {
  const options = selected.value?.modes.filter(
    (mode) => mode.width === resolution.width && mode.height === resolution.height,
  )
  const current = selected.value?.mode.refreshRate ?? 60
  const mode = options?.sort(
    (a, b) =>
      Math.abs(a.refreshRate - current) - Math.abs(b.refreshRate - current) ||
      b.refreshRate - a.refreshRate,
  )[0]
  if (mode) applyMode(mode)
}

watch(
  () => selected.value?.id,
  () => {
    refreshPage.value = 0
  },
)
watch(refreshPages, (count) => {
  refreshPage.value = Math.min(refreshPage.value, count - 1)
})
</script>

<template>
  <section class="page-view">
    <div class="section-caption">
      <span>分辨率与刷新率</span><span>{{ selected?.modes.length ?? 0 }} 种模式</span>
    </div>
    <div class="card compact-card refresh-card">
      <div class="card-title">
        <PanelIcon name="gauge" /><strong>刷新率</strong><span>{{ sizeText }}</span>
      </div>
      <div v-if="shownRates.length" class="choice-grid rate-grid">
        <button
          v-for="rate in shownRates"
          :key="rate"
          class="choice-option"
          :class="{ chosen: currentRate !== null && Math.abs(currentRate - rate) < 0.02 }"
          :aria-pressed="currentRate !== null && Math.abs(currentRate - rate) < 0.02"
          :disabled="locked"
          @click="applyRate(rate)"
        >
          {{ formatRefreshRate(rate) }} Hz
        </button>
      </div>
      <p v-else class="card-note">暂无可切换的刷新率。</p>
      <div v-if="refreshPages > 1" class="pager">
        <button
          class="pager-button"
          :disabled="refreshPage === 0"
          aria-label="上一组刷新率"
          @click="refreshPage--"
        >
          <PanelIcon name="chevron-left" :size="16" />
        </button>
        <span>{{ refreshPage + 1 }} / {{ refreshPages }}</span>
        <button
          class="pager-button"
          :disabled="refreshPage + 1 >= refreshPages"
          aria-label="下一组刷新率"
          @click="refreshPage++"
        >
          <PanelIcon name="chevron-right" :size="16" />
        </button>
      </div>
    </div>
    <div class="card compact-card resolution-card">
      <div class="card-title">
        <PanelIcon name="resolution" /><strong>分辨率（清晰度）</strong>
        <span>{{ resolutions.length }} 种</span>
      </div>
      <div
        v-if="resolutions.length"
        :key="selected?.id"
        class="resolution-list"
        role="region"
        aria-label="可滚动的分辨率列表"
        tabindex="0"
      >
        <button
          v-for="resolution in resolutions"
          :key="`${resolution.width}x${resolution.height}`"
          class="resolution-option"
          :class="{
            chosen:
              selected?.mode.width === resolution.width &&
              selected?.mode.height === resolution.height,
          }"
          :disabled="locked"
          @click="applyResolution(resolution)"
        >
          <span class="flex-1">{{ resolution.width }} × {{ resolution.height }}</span>
          <small class="text-subtle text-[10px] font-400">{{
            selected?.mode.width === resolution.width && selected?.mode.height === resolution.height
              ? '当前'
              : '切换'
          }}</small>
          <PanelIcon
            v-if="
              selected?.mode.width === resolution.width &&
              selected?.mode.height === resolution.height
            "
            name="check"
            :size="16"
          />
        </button>
      </div>
      <p v-else class="card-note">暂无可切换的分辨率。</p>
    </div>
    <div class="scale-note">
      <PanelIcon name="info" :size="16" />系统缩放 {{ scaleText }} · 缩放比例由 Windows 设置管理
    </div>
  </section>
</template>
