<script setup lang="ts">
import type { AppSettings } from '@screentools/contracts'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import ChoiceButton from '@renderer/components/ChoiceButton.vue'
import { useTraySession } from '@renderer/composables/useTraySession'
import { useControlsStore } from '@renderer/stores/controls'
import { useUpdatesStore } from '@renderer/stores/updates'
import { screenTools } from '@renderer/api/screen-tools'

defineOptions({ name: 'AppSettingsView' })

const { settings, launchAtLoginAvailable: available, locked } = useTraySession()
const controls = useControlsStore()
const updates = useUpdatesStore()
const themeOptions = [
  { value: 'system', label: '跟随系统', icon: 'monitor' },
  { value: 'light', label: '白色', icon: 'sun' },
  { value: 'dark', label: '黑色', icon: 'moon' },
] as const

function changeLaunchAtLogin(event: Event): void {
  if (!settings.value || !available.value || locked.value) return
  const launchAtLogin = (event.target as HTMLInputElement).checked
  void controls.execute({
    type: 'settings',
    settings: { ...settings.value, launchAtLogin },
  })
}

function changeTheme(theme: AppSettings['theme']): void {
  if (!settings.value || locked.value || settings.value.theme === theme) return
  void controls.execute({
    type: 'settings',
    settings: { ...settings.value, theme },
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
        <ChoiceButton
          v-for="option in themeOptions"
          :key="option.value"
          class="inline-flex items-center justify-center gap-[5px]"
          :disabled="locked || !settings"
          :pressed="(settings?.theme ?? 'system') === option.value"
          @click="changeTheme(option.value)"
        >
          <PanelIcon :name="option.icon" :size="15" />
          {{ option.label }}
        </ChoiceButton>
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
    <div class="section-caption"><span>版本更新</span></div>
    <div class="card compact-card update-card">
      <div class="card-title">
        <PanelIcon name="refresh" /><strong>ScreenTools</strong>
        <span>v{{ updates.state?.currentVersion ?? screenTools.version }}</span>
      </div>
      <p v-if="updates.state?.error" class="card-note update-error" role="alert">
        {{ updates.state.error }}
      </p>
      <p v-else-if="updates.state?.phase === 'checking'" class="card-note">
        正在检查 GitHub 最新版本…
      </p>
      <p v-else-if="updates.state?.phase === 'downloading'" class="card-note">
        正在下载 v{{ updates.state.latestVersion }}：{{ updates.state.progress ?? 0 }}%
      </p>
      <p v-else-if="updates.state?.phase === 'ready'" class="card-note">
        v{{ updates.state.latestVersion }} 已下载。确认安装后，应用会退出并打开安装程序。
      </p>
      <p v-else-if="updates.state?.latestVersion && updates.hasUpdate" class="card-note">
        发现新版本 v{{ updates.state.latestVersion }}，正在准备下载。
      </p>
      <p v-else-if="!updates.state" class="card-note">正在读取更新状态…</p>
      <p v-else class="card-note">已是最新版本。</p>
      <p v-if="updates.hasUpdate && !updates.state?.canDownload" class="card-note">
        安装包尚未上传，可稍后重试或查看 GitHub 发布页。
      </p>
      <div
        v-if="updates.state?.phase === 'downloading'"
        class="update-progress"
        role="progressbar"
        :aria-valuenow="updates.state.progress ?? 0"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="更新下载进度"
      >
        <span :style="{ width: `${updates.state.progress ?? 0}%` }"></span>
      </div>
      <div class="update-actions">
        <button
          class="dialog-button"
          :disabled="updates.state?.phase === 'checking' || updates.state?.phase === 'downloading'"
          @click="updates.check()"
        >
          检查更新
        </button>
        <button
          v-if="updates.state?.phase === 'ready'"
          class="primary-action"
          @click="updates.install()"
        >
          确认安装
        </button>
        <button
          v-else-if="
            updates.state?.phase === 'error' && updates.hasUpdate && updates.state?.canDownload
          "
          class="primary-action"
          @click="updates.download()"
        >
          重新下载
        </button>
        <button
          v-else-if="updates.hasUpdate && !updates.state?.canDownload"
          class="dialog-button"
          @click="updates.openReleasePage()"
        >
          查看发布页
        </button>
      </div>
    </div>
  </section>
</template>
