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

function changeLaunchAtLogin(event: Event): void {
  if (!props.settings || !props.available || props.locked) return
  const launchAtLogin = (event.target as HTMLInputElement).checked
  void controls.execute({
    type: 'settings',
    settings: { ...props.settings, launchAtLogin },
  })
}
</script>

<template>
  <section class="page-view settings-page">
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
