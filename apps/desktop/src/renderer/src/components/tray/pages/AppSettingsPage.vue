<script setup lang="ts">
import type { AppSettings } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
import PanelIcon from '../PanelIcon.vue'

defineOptions({ name: 'AppSettingsPage' })

const props = defineProps<{
  settings: AppSettings | undefined
  available: boolean
  locked: boolean
}>()

const controls = useControlsStore()
const themeOptions = [
  { value: 'system', label: '跟随系统', icon: 'monitor' },
  { value: 'light', label: '白色', icon: 'sun' },
  { value: 'dark', label: '黑色', icon: 'moon' },
] as const

function changeLaunchAtLogin(event: Event): void {
  if (!props.settings || !props.available || props.locked) return
  const launchAtLogin = (event.target as HTMLInputElement).checked
  void controls.execute({
    type: 'settings',
    settings: { ...props.settings, launchAtLogin },
  })
}

function changeTheme(theme: AppSettings['theme']): void {
  if (!props.settings || props.locked || props.settings.theme === theme) return
  void controls.execute({
    type: 'settings',
    settings: { ...props.settings, theme },
  })
}
</script>

<template>
  <section class="page-view settings-page">
    <div class="section-caption"><span>外观</span></div>
    <div class="card compact-card">
      <div class="card-title">
        <PanelIcon name="sun" /><strong>主题</strong><span>面板外观</span>
      </div>
      <div class="choice-grid theme-grid" role="group" aria-label="选择主题">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          class="choice-option inline-flex items-center justify-center gap-[5px]"
          type="button"
          :disabled="locked || !settings"
          :class="{ chosen: (settings?.theme ?? 'system') === option.value }"
          :aria-pressed="(settings?.theme ?? 'system') === option.value"
          @click="changeTheme(option.value)"
        >
          <PanelIcon :name="option.icon" :size="15" />
          {{ option.label }}
        </button>
      </div>
      <p class="card-note">仅影响 ScreenTools 外观，不会更改 Windows 主题。</p>
    </div>
    <div class="section-caption"><span>启动与运行</span></div>
    <div class="card toggle-card">
      <div class="card-title">
        <PanelIcon name="power" /><strong>开机自启动</strong>
        <p class="card-note">登录 Windows 后在托盘后台启动，不会弹出主窗口。</p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          aria-label="开机自启动"
          :checked="settings?.launchAtLogin ?? false"
          :disabled="locked || !settings || !available"
          @change="changeLaunchAtLogin"
        />
        <span></span>
      </label>
    </div>
    <p class="settings-description">
      {{
        available ? '也可以在 Windows 的“启动应用”中管理此设置。' : '开机自启动仅在安装版中可用。'
      }}
    </p>
  </section>
</template>
