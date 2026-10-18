<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ChangePlan, DisplayMode, DisplaySetting, HardwareValue } from '@screentools/contracts'
import { screenTools } from '@renderer/api/screen-tools'
import { useControlsStore } from '@renderer/stores/controls'
import { useDisplaysStore } from '@renderer/stores/displays'
import PanelIcon from './PanelIcon.vue'
import { useHardwareSliderDraft } from './useHardwareSliderDraft'
import type { SliderFeature } from './useHardwareSliderDraft'

type Tab = 'info' | 'picture' | 'modes'
type Resolution = { width: number; height: number }
const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'info', icon: 'monitor', label: '屏幕信息' },
  { id: 'picture', icon: 'sliders', label: '画面配置' },
  { id: 'modes', icon: 'resolution', label: '刷新率与清晰度' },
]
const topologies = {
  extend: '扩展',
  clone: '复制',
  internal: '仅主屏',
  external: '仅外屏',
} as const

const controls = useControlsStore()
const displaysStore = useDisplaysStore()
const { state, busy, error: controlError } = storeToRefs(controls)
const { displays, loading, error: displayError } = storeToRefs(displaysStore)
const tab = shallowRef<Tab>('info')
const selectedId = shallowRef('')
const resolutionPage = shallowRef(0)
const refreshPage = shallowRef(0)
const sliderDraft = useHardwareSliderDraft()
const now = shallowRef(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

const selected = computed(
  () => state.value?.devices.find((d) => d.id === selectedId.value) ?? state.value?.devices[0],
)
const deviceChoices = computed(() =>
  (state.value?.devices.length ?? 0) > 1 ? state.value!.devices : [],
)
const capabilities = computed(() => state.value?.capabilities[selected.value?.id ?? ''] ?? {})
const locked = computed(() => busy.value || !!state.value?.pending)
const title = computed(() =>
  selected.value
    ? state.value?.settings.aliases[selected.value.id] || selected.value.name
    : displays.value[0]?.name || 'ScreenTools',
)
const subtitle = computed(() =>
  selected.value
    ? `${selected.value.primary ? '主显示器' : '外接显示器'} · ${selected.value.connection} · ${selected.value.mode.width} × ${selected.value.mode.height} · ${hz(selected.value.mode.refreshRate)} Hz`
    : loading.value
      ? '正在读取显示器…'
      : '显示器控制中心',
)
const sizeText = computed(() =>
  selected.value
    ? `${selected.value.mode.width} × ${selected.value.mode.height}`
    : displays.value[0]
      ? `${displays.value[0].pixelSize.width} × ${displays.value[0].pixelSize.height}`
      : '—',
)
const currentRate = computed(
  () => selected.value?.mode.refreshRate ?? displays.value[0]?.refreshRate ?? null,
)
const scaleText = computed(() =>
  displays.value.length === 1
    ? `${Math.round(displays.value[0]!.scaleFactor * 100)}%`
    : '由 Windows 管理',
)
const statusError = computed(
  () => controlError.value || state.value?.error || displayError.value || '',
)
const countdown = computed(() =>
  Math.max(0, Math.ceil(((state.value?.pending?.expiresAt ?? now.value) - now.value) / 1000)),
)
const resolutions = computed<Resolution[]>(() => {
  const items = new Map<string, Resolution>()
  for (const mode of selected.value?.modes ?? [])
    items.set(`${mode.width}x${mode.height}`, { width: mode.width, height: mode.height })
  return [...items.values()].sort(
    (a, b) => b.width * b.height - a.width * a.height || b.width - a.width,
  )
})
const resolutionPages = computed(() => Math.max(1, Math.ceil(resolutions.value.length / 6)))
const shownResolutions = computed(() =>
  resolutions.value.slice(resolutionPage.value * 6, resolutionPage.value * 6 + 6),
)
const refreshRates = computed(() => {
  const current = selected.value?.mode
  if (!current) return []
  return [
    ...new Set(
      selected.value?.modes
        .filter((m) => m.width === current.width && m.height === current.height)
        .map((m) => Number(m.refreshRate.toFixed(2))) ?? [],
    ),
  ].sort((a, b) => b - a)
})
const refreshPages = computed(() => Math.max(1, Math.ceil(refreshRates.value.length / 8)))
const shownRates = computed(() =>
  refreshRates.value.slice(refreshPage.value * 8, refreshPage.value * 8 + 8),
)
function hz(rate: number): string {
  return String(Number(rate.toFixed(2)))
}
function percent(value?: HardwareValue): number {
  return value && value.max > value.min
    ? Math.round(((value.current - value.min) * 100) / (value.max - value.min))
    : 0
}
function sourceName(value: number): string {
  return (
    ({ 0x0f: 'DP 1', 0x10: 'DP 2', 0x11: 'HDMI 1', 0x12: 'HDMI 2' } as Record<number, string>)[
      value
    ] ?? `VCP 0x${value.toString(16).toUpperCase()}`
  )
}
function selectTab(next: Tab): void {
  tab.value = next
}
function selectDevice(id: string): void {
  selectedId.value = id
}
function snapshotSettings(): DisplaySetting[] {
  return (state.value?.devices ?? []).map((d) => ({
    id: d.id,
    mode: { ...d.mode },
    x: d.x,
    y: d.y,
    rotation: d.rotation,
    primary: d.primary,
    ...(d.hdr?.supported ? { hdrEnabled: d.hdr.enabled } : {}),
  }))
}
async function applySettings(changes: DisplaySetting[]): Promise<void> {
  if (!changes.length || locked.value) return
  await controls.execute({ type: 'apply', plan: { displays: changes, hardware: [] } })
}
function applyMode(mode: DisplayMode): void {
  const changes = snapshotSettings()
  const target = changes.find((d) => d.id === selected.value?.id)
  if (!target) return
  target.mode = { ...mode }
  void applySettings(changes)
}
function applyRate(rate: number): void {
  const current = selected.value?.mode
  const mode = selected.value?.modes.find(
    (m) =>
      m.width === current?.width &&
      m.height === current.height &&
      Math.abs(m.refreshRate - rate) < 0.02,
  )
  if (mode) applyMode(mode)
}
function applyResolution(res: Resolution): void {
  const options = selected.value?.modes.filter(
    (m) => m.width === res.width && m.height === res.height,
  )
  const currentRate = selected.value?.mode.refreshRate ?? 60
  const mode = options?.sort(
    (a, b) =>
      Math.abs(a.refreshRate - currentRate) - Math.abs(b.refreshRate - currentRate) ||
      b.refreshRate - a.refreshRate,
  )[0]
  if (mode) applyMode(mode)
}
function applyTopology(topology: NonNullable<ChangePlan['topology']>): void {
  void controls.execute({ type: 'apply', plan: { topology, displays: [], hardware: [] } })
}
function hardware(
  feature: 'brightness' | 'contrast' | 'volume' | 'inputSource',
  value: number,
): boolean {
  if (!selected.value || locked.value) return false
  if (
    feature === 'inputSource' &&
    !window.confirm('切换输入源可能使屏幕断开，无法自动恢复。请确认可以用显示器实体按键恢复。')
  )
    return false
  void controls.execute({ type: 'hardware', setting: { id: selected.value.id, feature, value } })
  return true
}
function sliderValue(feature: SliderFeature): number {
  const capability = capabilities.value[feature]
  if (!capability) return 0
  return sliderDraft.current(selected.value?.id ?? '', feature, percent(capability))
}
async function commitSlider(feature: SliderFeature, value: number): Promise<void> {
  const deviceId = selected.value?.id
  if (!deviceId) return
  if (locked.value) {
    sliderDraft.clear(deviceId, feature, value)
    return
  }
  await sliderDraft.commit(deviceId, feature, value, () =>
    controls.execute({ type: 'hardware', setting: { id: deviceId, feature, value } }),
  )
}
function bump(feature: SliderFeature, delta: -1 | 1): void {
  const value = capabilities.value[feature]
  if (value) void commitSlider(feature, Math.max(0, Math.min(100, sliderValue(feature) + delta)))
}
function rangeChange(feature: SliderFeature, event: Event): void {
  void commitSlider(feature, Number((event.target as HTMLInputElement).value))
}
function previewRange(feature: SliderFeature, event: Event): void {
  const deviceId = selected.value?.id
  if (deviceId)
    sliderDraft.preview(deviceId, feature, Number((event.target as HTMLInputElement).value))
}
function sourceChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  if (!hardware('inputSource', Number(select.value))) {
    select.value = String(capabilities.value.inputSource?.current ?? '')
  }
}
function hdrChange(event: Event): void {
  const changes = snapshotSettings()
  const target = changes.find((d) => d.id === selected.value?.id)
  if (!target) return
  target.hdrEnabled = (event.target as HTMLInputElement).checked
  void applySettings(changes)
}
function refreshAll(): void {
  void controls.execute({ type: 'refresh' })
  void displaysStore.refresh()
}

watch(
  () => state.value?.devices,
  (devices) => {
    if (!devices?.some((d) => d.id === selectedId.value))
      selectedId.value = devices?.find((d) => d.primary)?.id ?? devices?.[0]?.id ?? ''
  },
  { immediate: true },
)
watch(selectedId, () => {
  resolutionPage.value = 0
  refreshPage.value = 0
})
watch(resolutionPages, (count) => {
  resolutionPage.value = Math.min(resolutionPage.value, count - 1)
})
watch(refreshPages, (count) => {
  refreshPage.value = Math.min(refreshPage.value, count - 1)
})
onMounted(() => {
  displaysStore.start()
  controls.start()
  clock = setInterval(() => {
    now.value = Date.now()
  }, 250)
})
onUnmounted(() => {
  displaysStore.stop()
  controls.stop()
  clearInterval(clock)
})
</script>

<template>
  <main class="tray-app">
    <header class="app-header">
      <span class="app-logo"><PanelIcon name="monitor" :size="23" /></span>
      <div class="device-heading">
        <select
          v-if="deviceChoices.length"
          class="device-picker"
          :value="selectedId"
          aria-label="选择显示器"
          @change="selectDevice(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="device in deviceChoices" :key="device.id" :value="device.id">
            {{ state?.settings.aliases[device.id] || device.name }}
          </option>
        </select>
        <h1 v-else :title="title">{{ title }}</h1>
        <p :title="subtitle">{{ subtitle }}</p>
      </div>
      <button
        class="header-icon round"
        aria-label="收起面板"
        title="收起面板"
        @click="screenTools.hidePanel()"
      >
        <PanelIcon name="power" :size="21" />
      </button>
    </header>
    <nav class="tab-bar" role="tablist" aria-label="显示器控制页面">
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-label="item.label"
        :title="item.label"
        :class="{ active: tab === item.id }"
        @click="selectTab(item.id)"
      >
        <PanelIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span>
      </button>
    </nav>
    <div class="page-content">
      <div v-if="!selected && !displays.length" class="empty-state">
        <PanelIcon name="monitor" :size="42" />
        <h2>等待显示器信息</h2>
        <p>{{ loading ? '正在连接显示器服务…' : '连接显示器后刷新设备列表。' }}</p>
        <button class="primary-action" :disabled="busy" @click="refreshAll">重新检测</button>
      </div>

      <template v-else-if="tab === 'info'">
        <div class="monitor-preview">
          <div class="monitor-screen">
            <strong>{{ sizeText }}</strong
            ><span
              >{{ currentRate === null ? '刷新率未知' : `${hz(currentRate)} Hz` }} ·
              {{ selected?.primary ? '主显示器' : '活动显示器' }}</span
            >
          </div>
          <span class="monitor-stem"></span><span class="monitor-foot"></span>
        </div>
        <div class="signal-line">
          <span><i></i>当前画面</span><strong>{{ selected?.connection ?? '系统显示' }}</strong>
        </div>
        <div class="card input-card">
          <div class="card-title">
            <PanelIcon name="cable" /><strong>输入源</strong
            ><span>{{ selected?.connection ?? '—' }}</span>
          </div>
          <select
            v-if="capabilities.inputSource?.values?.length"
            class="source-select"
            :value="capabilities.inputSource.current"
            :disabled="locked"
            @change="sourceChange"
          >
            <option v-for="value in capabilities.inputSource.values" :key="value" :value="value">
              {{ sourceName(value)
              }}{{ value === capabilities.inputSource.current ? ' · 当前' : '' }}
            </option>
          </select>
          <p v-else class="card-note">
            {{ selected?.connection ?? '连接状态未知' }} ·
            {{ selected ? '当前设备未提供可切换的输入源' : '等待设备连接' }}
          </p>
        </div>
        <div class="card slider-card">
          <div class="card-title">
            <PanelIcon name="sun" /><strong>亮度</strong
            ><span class="value">{{
              capabilities.brightness ? sliderValue('brightness') : '—'
            }}</span>
          </div>
          <p class="card-note">显示器硬件亮度 · DDC/CI</p>
          <div v-if="capabilities.brightness" class="slider-row">
            <button aria-label="降低亮度" :disabled="locked" @click="bump('brightness', -1)">
              <PanelIcon name="minus" :size="16" /></button
            ><input
              :value="sliderValue('brightness')"
              aria-label="亮度"
              type="range"
              min="0"
              max="100"
              :disabled="locked"
              :style="{ '--fill': `${sliderValue('brightness')}%` }"
              @input="previewRange('brightness', $event)"
              @change="rangeChange('brightness', $event)"
            /><button aria-label="提高亮度" :disabled="locked" @click="bump('brightness', 1)">
              <PanelIcon name="plus" :size="16" />
            </button>
          </div>
          <p v-else class="card-note">暂不可用，设备能力会自动更新。</p>
        </div>
        <div class="card slider-card">
          <div class="card-title">
            <PanelIcon name="volume" /><strong>显示器音量</strong
            ><span class="value">{{ capabilities.volume ? sliderValue('volume') : '—' }}</span>
          </div>
          <p class="card-note">
            {{ capabilities.volume ? '显示器内置音量' : '当前设备未提供可控音量' }}
          </p>
          <div v-if="capabilities.volume" class="slider-row">
            <button aria-label="降低音量" :disabled="locked" @click="bump('volume', -1)">
              <PanelIcon name="minus" :size="16" /></button
            ><input
              :value="sliderValue('volume')"
              aria-label="显示器音量"
              type="range"
              min="0"
              max="100"
              :disabled="locked"
              :style="{ '--fill': `${sliderValue('volume')}%` }"
              @input="previewRange('volume', $event)"
              @change="rangeChange('volume', $event)"
            /><button aria-label="提高音量" :disabled="locked" @click="bump('volume', 1)">
              <PanelIcon name="plus" :size="16" />
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'picture'">
        <div class="section-caption"><span>画面与配置</span><span>当前显示器</span></div>
        <div class="card compact-card">
          <div class="card-title">
            <PanelIcon name="layout" /><strong>显示拓扑</strong><span>20 秒确认</span>
          </div>
          <div class="choice-grid topology-grid">
            <button
              v-for="(name, key) in topologies"
              :key="key"
              :disabled="locked || !selected"
              @click="applyTopology(key)"
            >
              {{ name }}
            </button>
          </div>
        </div>
        <div v-if="state?.profiles.length" class="card compact-card">
          <div class="card-title">
            <PanelIcon name="sparkles" /><strong>配置方案</strong
            ><span>{{ state?.profiles.length ?? 0 }} 个</span>
          </div>
          <div class="choice-grid profile-grid">
            <button
              v-for="p in state.profiles.slice(0, 4)"
              :key="p.id"
              :disabled="locked"
              @click="controls.execute({ type: 'apply-profile', id: p.id })"
            >
              {{ p.name }}
            </button>
          </div>
        </div>
        <div class="card slider-card">
          <div class="card-title">
            <PanelIcon name="sun" /><strong>硬件亮度</strong
            ><span class="value">{{
              capabilities.brightness ? sliderValue('brightness') : '—'
            }}</span>
          </div>
          <p class="card-note">释放滑块时提交，设备响应可能需要数秒</p>
          <div v-if="capabilities.brightness" class="slider-row">
            <button aria-label="降低亮度" :disabled="locked" @click="bump('brightness', -1)">
              <PanelIcon name="minus" :size="16" /></button
            ><input
              :value="sliderValue('brightness')"
              aria-label="硬件亮度"
              type="range"
              min="0"
              max="100"
              :disabled="locked"
              :style="{ '--fill': `${sliderValue('brightness')}%` }"
              @input="previewRange('brightness', $event)"
              @change="rangeChange('brightness', $event)"
            /><button aria-label="提高亮度" :disabled="locked" @click="bump('brightness', 1)">
              <PanelIcon name="plus" :size="16" />
            </button>
          </div>
          <p v-else class="card-note">暂不可用，设备能力会自动更新。</p>
        </div>
        <div class="card slider-card">
          <div class="card-title">
            <PanelIcon name="contrast" /><strong>对比度</strong
            ><span class="value">{{ capabilities.contrast ? sliderValue('contrast') : '—' }}</span>
          </div>
          <p class="card-note">显示器硬件对比度</p>
          <div v-if="capabilities.contrast" class="slider-row">
            <button aria-label="降低对比度" :disabled="locked" @click="bump('contrast', -1)">
              <PanelIcon name="minus" :size="16" /></button
            ><input
              :value="sliderValue('contrast')"
              aria-label="对比度"
              type="range"
              min="0"
              max="100"
              :disabled="locked"
              :style="{ '--fill': `${sliderValue('contrast')}%` }"
              @input="previewRange('contrast', $event)"
              @change="rangeChange('contrast', $event)"
            /><button aria-label="提高对比度" :disabled="locked" @click="bump('contrast', 1)">
              <PanelIcon name="plus" :size="16" />
            </button>
          </div>
        </div>
        <div v-if="selected?.hdr?.supported" class="card toggle-card">
          <div class="card-title">
            <PanelIcon name="sparkles" /><strong>HDR / 高级颜色</strong
            ><span>{{ selected.hdr.enabled ? '已开启' : '已关闭' }}</span>
          </div>
          <label class="switch"
            ><input
              type="checkbox"
              :checked="selected.hdr.enabled"
              :disabled="locked"
              @change="hdrChange" /><span></span
          ></label>
        </div>
      </template>

      <template v-else>
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
              :class="{ chosen: currentRate !== null && Math.abs(currentRate - rate) < 0.02 }"
              :disabled="locked"
              @click="applyRate(rate)"
            >
              {{ hz(rate) }} Hz
            </button>
          </div>
          <p v-else class="card-note">暂无可切换的刷新率。</p>
          <div v-if="refreshPages > 1" class="pager">
            <button :disabled="refreshPage === 0" aria-label="上一组刷新率" @click="refreshPage--">
              <PanelIcon name="chevron-left" :size="16" /></button
            ><span>{{ refreshPage + 1 }} / {{ refreshPages }}</span
            ><button
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
            <PanelIcon name="resolution" /><strong>分辨率（清晰度）</strong
            ><span>{{ resolutions.length }} 种</span>
          </div>
          <div v-if="shownResolutions.length" class="resolution-list">
            <button
              v-for="res in shownResolutions"
              :key="`${res.width}x${res.height}`"
              :class="{
                chosen: selected?.mode.width === res.width && selected?.mode.height === res.height,
              }"
              :disabled="locked"
              @click="applyResolution(res)"
            >
              <span>{{ res.width }} × {{ res.height }}</span
              ><small>{{
                selected?.mode.width === res.width && selected?.mode.height === res.height
                  ? '当前'
                  : '切换'
              }}</small
              ><PanelIcon
                v-if="selected?.mode.width === res.width && selected?.mode.height === res.height"
                name="check"
                :size="16"
              />
            </button>
          </div>
          <p v-else class="card-note">暂无可切换的分辨率。</p>
          <div class="pager">
            <button
              :disabled="resolutionPage === 0"
              aria-label="上一页分辨率"
              @click="resolutionPage--"
            >
              <PanelIcon name="chevron-left" :size="16" /></button
            ><span>{{ resolutionPage + 1 }} / {{ resolutionPages }}</span
            ><button
              :disabled="resolutionPage + 1 >= resolutionPages"
              aria-label="下一页分辨率"
              @click="resolutionPage++"
            >
              <PanelIcon name="chevron-right" :size="16" />
            </button>
          </div>
        </div>
        <div class="scale-note">
          <PanelIcon name="info" :size="16" />系统缩放 {{ scaleText }} · 缩放比例由 Windows 设置管理
        </div>
      </template>
    </div>
    <div v-if="statusError" class="status-error" role="alert" :title="statusError">
      {{ statusError }}
    </div>
    <footer class="status-footer">
      <i></i
      ><span>{{
        selected ? `${state?.devices.length ?? 0} 台显示器已连接` : '等待显示器连接'
      }}</span
      ><button :disabled="busy" title="刷新设备" aria-label="刷新设备" @click="refreshAll">
        <PanelIcon name="refresh" :size="16" />
      </button>
    </footer>
    <div
      v-if="state?.pending"
      class="confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div class="confirm-card">
        <span class="confirm-icon"><PanelIcon name="monitor" :size="26" /></span>
        <h2 id="confirm-title">保留新的显示配置？</h2>
        <p>{{ countdown }} 秒后自动恢复。若画面异常，请等待恢复或立即恢复。</p>
        <div class="button-row">
          <button
            :disabled="busy"
            @click="controls.execute({ type: 'revert', token: state.pending.token })"
          >
            立即恢复</button
          ><button
            class="accent-button"
            :disabled="busy || countdown === 0"
            @click="controls.execute({ type: 'confirm', token: state.pending.token })"
          >
            保留配置
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
