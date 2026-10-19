<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type {
  CustomFilterSettings,
  CustomScreenFilter,
  ScreenFilterId,
  ScreenFilterState,
} from '@screentools/contracts'
import {
  createCustomFilterMatrix,
  defaultCustomFilterSettings,
  getScreenFilterMatrix,
  screenFilterPresets,
  type ColorMatrix,
} from '@screentools/display-core'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import ChoiceButton from '@renderer/components/ChoiceButton.vue'
import CustomFilterEditor from './CustomFilterEditor.vue'
import FilterPreview from './FilterPreview.vue'
import SavedFilters from './SavedFilters.vue'

const props = defineProps<{
  state: ScreenFilterState | undefined
  locked: boolean
}>()

const filterGroups: readonly {
  label: string
  filters: readonly { id: ScreenFilterId; label: string; icon: string; description?: string }[]
}[] = [
  {
    label: '日常',
    filters: [
      { id: 'off', label: '原色', icon: 'sun' },
      { id: 'reading', label: '阅读', icon: 'book' },
      { id: 'night', label: '夜间', icon: 'moon' },
      { id: 'grayscale', label: '灰度', icon: 'contrast' },
    ],
  },
  {
    label: 'FPS 游戏',
    filters: [
      { id: 'fps-competitive', label: '竞技', icon: 'gauge', description: '适度增强对比与色彩' },
      { id: 'fps-vivid', label: '鲜艳', icon: 'sparkles', description: '明显提高色彩饱和度' },
      { id: 'fps-dark', label: '暗场', icon: 'moon', description: '提亮暗部，整体对比更柔和' },
      {
        id: 'fps-focus',
        label: '专注',
        icon: 'contrast',
        description: '适度降低饱和度，减少色彩干扰',
      },
    ],
  },
]
const controls = useControlsStore()
const mode = shallowRef<'presets' | 'custom'>('presets')
const previewedId = shallowRef<ScreenFilterId | null>('reading')
const previewedCustomId = shallowRef<string | null>(null)
const previewLabel = shallowRef('阅读')
const previewMatrix = shallowRef<ColorMatrix>(getScreenFilterMatrix('reading'))
const customFilters = computed(() => controls.state?.customFilters ?? [])
const disabled = computed(() => props.locked || !props.state?.available)
const note = computed(() => {
  if (!props.state) return '正在检测系统能力…'
  if (!props.state.available) return props.state.reason ?? '当前系统不可用'
  return '作用于所有显示器，退出 ScreenTools 后恢复'
})

watch(
  () => [props.state?.active, props.state?.customId] as const,
  (active) => {
    if (active[0] === 'custom') {
      const filter = customFilters.value.find((entry) => entry.id === active[1])
      if (filter) {
        mode.value = 'custom'
        previewSavedFilter(filter)
      }
    } else if (active[0] && active[0] !== 'off') {
      mode.value = 'presets'
      previewPreset(active[0])
    }
  },
  { immediate: true },
)

function previewPreset(filter: ScreenFilterId): void {
  previewedId.value = filter
  previewedCustomId.value = null
  previewLabel.value = screenFilterPresets.find((entry) => entry.id === filter)?.label ?? '原色'
  previewMatrix.value = getScreenFilterMatrix(filter)
}

function isPreviewed(filter: ScreenFilterId): boolean {
  return !!props.state && previewedId.value === filter && props.state.active !== filter
}

function previewCustom(settings: CustomFilterSettings, label: string): void {
  previewedId.value = null
  previewedCustomId.value = null
  previewLabel.value = label
  previewMatrix.value = createCustomFilterMatrix(settings)
}

function previewSavedFilter(filter: CustomScreenFilter): void {
  previewCustom(filter.settings, filter.name)
  previewedCustomId.value = filter.id
}

function selectMode(next: 'presets' | 'custom'): void {
  mode.value = next
  if (next === 'presets') {
    const active = props.state?.active
    previewPreset(active && active !== 'custom' && active !== 'off' ? active : 'reading')
  } else {
    const active = customFilters.value.find((entry) => entry.id === props.state?.customId)
    if (active) previewSavedFilter(active)
    else previewCustom(defaultCustomFilterSettings, '自定义')
  }
}

function applyFilter(filter: ScreenFilterId): void {
  previewPreset(filter)
  if (disabled.value || props.state?.active === filter) return
  void controls.execute({ type: 'screen-filter', filter })
}
</script>

<template>
  <div class="filter-content">
    <div class="filter-mode-switch" role="group" aria-label="滤镜类型">
      <ChoiceButton :pressed="mode === 'presets'" @click="selectMode('presets')">
        预设滤镜
      </ChoiceButton>
      <ChoiceButton :pressed="mode === 'custom'" @click="selectMode('custom')">
        自定义滤镜
      </ChoiceButton>
    </div>
    <div v-if="mode === 'presets'" class="card scene-card">
      <div class="card-title">
        <PanelIcon name="contrast" /><strong>屏幕滤镜</strong><span>所有显示器</span>
      </div>
      <div v-for="group in filterGroups" :key="group.label" class="filter-group">
        <div class="filter-group-label">{{ group.label }}</div>
        <div class="scene-grid">
          <div v-for="filter in group.filters" :key="filter.id" class="preset-filter">
            <ChoiceButton
              variant="scene"
              :disabled="disabled"
              :pressed="state?.active === filter.id"
              :class="{ previewing: isPreviewed(filter.id) }"
              :aria-label="
                [
                  filter.label,
                  state?.active === filter.id ? '使用中' : isPreviewed(filter.id) ? '预览' : '',
                  filter.description,
                ]
                  .filter(Boolean)
                  .join('，')
              "
              :title="filter.description"
              @pointerenter="previewPreset(filter.id)"
              @focus="previewPreset(filter.id)"
              @click="applyFilter(filter.id)"
            >
              <PanelIcon :name="filter.icon" :size="22" />
              <span>{{ filter.label }}</span>
            </ChoiceButton>
            <span v-if="state?.active === filter.id" class="preset-filter-badge">使用中</span>
            <span v-else-if="isPreviewed(filter.id)" class="preset-filter-badge">预览</span>
          </div>
        </div>
      </div>
      <p class="card-note">{{ note }}</p>
    </div>
    <SavedFilters
      v-if="mode === 'custom'"
      :filters="customFilters"
      :active-id="state?.customId ?? null"
      :preview-id="previewedCustomId"
      :disabled="locked"
      :can-apply="!!state?.available"
      @preview="previewSavedFilter"
    />
    <FilterPreview
      :label="previewLabel"
      :matrix="previewMatrix"
      :active="!!state && state.active !== 'off'"
      :compact="mode === 'custom'"
    />
    <CustomFilterEditor
      v-if="mode === 'custom'"
      :filters="customFilters"
      :active-id="state?.customId ?? null"
      :disabled="locked"
      @preview="previewCustom"
    />
  </div>
</template>

<style scoped>
.filter-content {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-height: 0;
  /* 卡片保持原宽度，向滚动容器外扩出阴影空间。 */
  margin-inline: -9px;
  padding: 0 9px 12px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}
.filter-content::-webkit-scrollbar {
  display: none;
}
.filter-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: none;
}
.scene-option.previewing {
  border-color: var(--accent-border);
}
.preset-filter {
  position: relative;
  min-width: 0;
}
.preset-filter .scene-option {
  width: 100%;
  height: 78px;
  gap: 4px;
  padding-top: 15px;
}
.preset-filter-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-strong);
  font-size: 9px;
  line-height: 1.2;
  pointer-events: none;
}
.filter-group {
  margin-top: 11px;
}
.filter-group-label {
  color: var(--subtle);
  font-size: 10px;
}
.filter-group .scene-grid {
  margin-top: 6px;
}
</style>
