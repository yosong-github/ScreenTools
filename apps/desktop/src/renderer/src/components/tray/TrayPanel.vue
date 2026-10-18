<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { screenTools } from '@renderer/api/screen-tools'
import { useControlsStore } from '@renderer/stores/controls'
import { useDisplaysStore } from '@renderer/stores/displays'
import { formatPixelSize, formatRefreshRate } from '@renderer/utils/display-format'
import { provideHardwareSliderDraft } from './hardware/hardware-slider-context'
import PanelIcon from './PanelIcon.vue'

type Tab = 'info' | 'picture' | 'modes'
const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'info', icon: 'monitor', label: '屏幕信息' },
  { id: 'picture', icon: 'sliders', label: '画面配置' },
  { id: 'modes', icon: 'resolution', label: '刷新率与清晰度' },
]
const ScreenInfoPage = defineAsyncComponent(() => import('./pages/ScreenInfoPage.vue'))
const PictureSettingsPage = defineAsyncComponent(() => import('./pages/PictureSettingsPage.vue'))
const DisplayModesPage = defineAsyncComponent(() => import('./pages/DisplayModesPage.vue'))
const AppSettingsPage = defineAsyncComponent(() => import('./pages/AppSettingsPage.vue'))

const controls = useControlsStore()
const displaysStore = useDisplaysStore()
const { state, busy, error: controlError } = storeToRefs(controls)
const { displays, loading, error: displayError } = storeToRefs(displaysStore)
const tab = shallowRef<Tab>('info')
const settingsOpen = shallowRef(false)
const selectedId = shallowRef('')
const now = shallowRef(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

provideHardwareSliderDraft()

const selected = computed(
  () =>
    state.value?.devices.find((device) => device.id === selectedId.value) ??
    state.value?.devices[0],
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
    ? `${selected.value.primary ? '主显示器' : '外接显示器'} · ${selected.value.connection} · ${formatPixelSize(selected.value.mode.width, selected.value.mode.height)} · ${formatRefreshRate(selected.value.mode.refreshRate)} Hz`
    : loading.value
      ? '正在读取显示器…'
      : '显示器控制中心',
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

function refreshAll(): void {
  void controls.execute({ type: 'refresh' })
  void displaysStore.refresh()
}

watch(
  () => state.value?.devices,
  (devices) => {
    if (!devices?.some((device) => device.id === selectedId.value))
      selectedId.value = devices?.find((device) => device.primary)?.id ?? devices?.[0]?.id ?? ''
  },
  { immediate: true },
)
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
          @change="selectedId = ($event.target as HTMLSelectElement).value"
        >
          <option v-for="device in deviceChoices" :key="device.id" :value="device.id">
            {{ state?.settings.aliases[device.id] || device.name }}
          </option>
        </select>
        <h1 v-else :title="title">{{ title }}</h1>
        <p :title="subtitle">{{ subtitle }}</p>
      </div>
      <button
        class="header-icon"
        :class="{ active: settingsOpen }"
        :aria-label="settingsOpen ? '返回显示器控制' : '打开设置'"
        :title="settingsOpen ? '返回显示器控制' : '打开设置'"
        :aria-pressed="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <PanelIcon name="settings" :size="20" />
      </button>
      <button
        class="header-icon"
        aria-label="收起面板"
        title="收起面板"
        @click="screenTools.hidePanel()"
      >
        <PanelIcon name="power" :size="21" />
      </button>
    </header>
    <nav v-if="!settingsOpen" class="tab-bar" role="tablist" aria-label="显示器控制页面">
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-label="item.label"
        :title="item.label"
        :class="{ active: tab === item.id }"
        @click="tab = item.id"
      >
        <PanelIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span>
      </button>
    </nav>
    <div v-else class="settings-bar">
      <button aria-label="返回显示器控制" title="返回显示器控制" @click="settingsOpen = false">
        <PanelIcon name="chevron-left" :size="19" />
      </button>
      <strong>应用设置</strong>
    </div>
    <div class="page-content">
      <AppSettingsPage
        v-if="settingsOpen"
        :settings="state?.settings"
        :available="state?.launchAtLoginAvailable ?? false"
        :locked="locked"
      />
      <div v-else-if="!selected && !displays.length" class="empty-state">
        <PanelIcon name="monitor" :size="42" />
        <h2>等待显示器信息</h2>
        <p>{{ loading ? '正在连接显示器服务…' : '连接显示器后刷新设备列表。' }}</p>
        <button class="primary-action" :disabled="busy" @click="refreshAll">重新检测</button>
      </div>
      <KeepAlive v-else :max="3">
        <ScreenInfoPage
          v-if="tab === 'info'"
          :selected="selected"
          :display="displays[0]"
          :capabilities="capabilities"
          :locked="locked"
        />
        <PictureSettingsPage
          v-else-if="tab === 'picture'"
          :selected="selected"
          :devices="state?.devices ?? []"
          :profiles="state?.profiles ?? []"
          :capabilities="capabilities"
          :locked="locked"
        />
        <DisplayModesPage
          v-else
          :selected="selected"
          :devices="state?.devices ?? []"
          :display="displays[0]"
          :scale-text="scaleText"
          :locked="locked"
        />
      </KeepAlive>
    </div>
    <div v-if="statusError" class="status-error" role="alert" :title="statusError">
      {{ statusError }}
    </div>
    <footer class="status-footer">
      <i></i>
      <span>{{
        selected ? `${state?.devices.length ?? 0} 台显示器已连接` : '等待显示器连接'
      }}</span>
      <button :disabled="busy" title="刷新设备" aria-label="刷新设备" @click="refreshAll">
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
            立即恢复
          </button>
          <button
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
