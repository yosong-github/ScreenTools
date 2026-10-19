<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { screenTools } from '@renderer/api/screen-tools'
import { provideHardwareSliderDraft } from '@renderer/components/hardware/hardware-slider-context'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import { useAppearanceTheme } from '@renderer/composables/useAppearanceTheme'
import { provideTraySession } from '@renderer/composables/useTraySession'
import { trayTabs, type TrayTab } from '@renderer/router'
import { useControlsStore } from '@renderer/stores/controls'
import { useDisplaysStore } from '@renderer/stores/displays'
import { formatPixelSize, formatRefreshRate } from '@renderer/utils/display-format'

const route = useRoute()
const router = useRouter()
const controls = useControlsStore()
const displaysStore = useDisplaysStore()
const { state, busy, error: controlError } = storeToRefs(controls)
const { displays, loading, error: displayError } = storeToRefs(displaysStore)
const lastTab = shallowRef<TrayTab>('info')
const now = shallowRef(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

provideHardwareSliderDraft()

const settingsOpen = computed(() => route.name === 'settings')
const selectedId = shallowRef('')
const selected = computed(
  () =>
    state.value?.devices.find((device) => device.id === selectedId.value) ??
    state.value?.devices[0],
)
const devices = computed(() => state.value?.devices ?? [])
const deviceChoices = computed(() => (devices.value.length > 1 ? devices.value : []))
const capabilities = computed(() => state.value?.capabilities[selected.value?.id ?? ''] ?? {})
const locked = computed(() => busy.value || !!state.value?.pending)
const display = computed(() => displays.value[0])
const settings = computed(() => state.value?.settings)
const launchAtLoginAvailable = computed(() => state.value?.launchAtLoginAvailable ?? false)
const screenFilter = computed(() => state.value?.screenFilter)
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
const themePreference = computed(() => state.value?.settings.theme ?? 'system')

provideTraySession({
  selected,
  devices,
  capabilities,
  locked,
  display,
  scaleText,
  settings,
  launchAtLoginAvailable,
  screenFilter,
})
useAppearanceTheme(themePreference)

function refreshAll(): void {
  void controls.execute({ type: 'refresh' })
  void displaysStore.refresh()
}
function openTab(name: TrayTab): void {
  if (route.name !== name) void router.push({ name })
}
function closeSettings(): void {
  void router.replace({ name: lastTab.value })
}
function toggleSettings(): void {
  if (settingsOpen.value) closeSettings()
  else void router.replace({ name: 'settings' })
}

watch(
  () => route.name,
  (name) => {
    if (trayTabs.some((item) => item.name === name)) lastTab.value = name as TrayTab
  },
  { immediate: true },
)
watch(
  () => state.value?.devices,
  (next) => {
    if (!next?.some((device) => device.id === selectedId.value))
      selectedId.value = next?.find((device) => device.primary)?.id ?? next?.[0]?.id ?? ''
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
        <h1 v-else class="device-name" :title="title">{{ title }}</h1>
        <p class="device-subtitle" :title="subtitle">{{ subtitle }}</p>
      </div>
      <button
        class="header-icon"
        :class="{ active: settingsOpen }"
        :aria-label="settingsOpen ? '返回显示器控制' : '打开设置'"
        :title="settingsOpen ? '返回显示器控制' : '打开设置'"
        :aria-pressed="settingsOpen"
        @click="toggleSettings"
      >
        <PanelIcon name="settings" :size="20" />
      </button>
      <button
        class="header-icon"
        aria-label="退出应用"
        title="退出应用"
        @click="screenTools.quitApp()"
      >
        <PanelIcon name="power" :size="21" />
      </button>
    </header>
    <nav
      v-if="!settingsOpen"
      class="tab-bar"
      role="tablist"
      aria-label="显示器控制页面"
      :data-active="route.name"
    >
      <button
        v-for="item in trayTabs"
        :key="item.name"
        class="tab-item"
        role="tab"
        :aria-selected="route.name === item.name"
        :aria-label="item.label"
        :title="item.label"
        :class="{ active: route.name === item.name }"
        @click="openTab(item.name)"
      >
        <PanelIcon :name="item.icon" :size="21" />
      </button>
    </nav>
    <div v-else class="settings-bar">
      <button
        class="settings-back"
        aria-label="返回显示器控制"
        title="返回显示器控制"
        @click="closeSettings"
      >
        <PanelIcon name="chevron-left" :size="19" />
      </button>
      <strong>应用设置</strong>
    </div>
    <div class="page-content">
      <RouterView v-if="settingsOpen" />
      <div v-else-if="!selected && !displays.length" class="empty-state">
        <PanelIcon name="monitor" :size="42" />
        <h2 class="empty-title">等待显示器信息</h2>
        <p class="empty-message">
          {{ loading ? '正在连接显示器服务…' : '连接显示器后刷新设备列表。' }}
        </p>
        <button class="primary-action" :disabled="busy" @click="refreshAll">重新检测</button>
      </div>
      <RouterView v-else v-slot="{ Component }">
        <KeepAlive :max="4">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>
    <div v-if="statusError" class="status-error" role="alert" :title="statusError">
      {{ statusError }}
    </div>
    <footer class="status-footer">
      <i class="status-indicator"></i>
      <span class="status-label">{{
        selected ? `${state?.devices.length ?? 0} 台显示器已连接` : '等待显示器连接'
      }}</span>
      <button
        class="status-refresh"
        :disabled="busy"
        title="刷新设备"
        aria-label="刷新设备"
        @click="refreshAll"
      >
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
        <h2 id="confirm-title" class="confirm-title">保留新的显示配置？</h2>
        <p class="confirm-description">
          {{ countdown }} 秒后自动恢复。若画面异常，请等待恢复或立即恢复。
        </p>
        <div class="button-row">
          <button
            class="dialog-button"
            :disabled="busy"
            @click="controls.execute({ type: 'revert', token: state.pending.token })"
          >
            立即恢复
          </button>
          <button
            class="dialog-button accent-button"
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
