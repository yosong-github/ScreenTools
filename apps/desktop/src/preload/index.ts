import { contextBridge, ipcRenderer } from 'electron'
import { displayChannels } from '@screentools/contracts'
import type {
  ScreenToolsApi,
  ControlState,
  DisplaySnapshot,
  UpdateState,
} from '@screentools/contracts'
import { version } from '../../package.json'

// 窗口保持静止，只让页面图层做合成动画，避免逐帧调用原生窗口接口。
function setPanelMotion(phase: 'hidden' | 'shown' | 'hiding'): void {
  document.documentElement?.setAttribute('data-panel-motion', phase)
}
if (document.documentElement) setPanelMotion('hidden')
else window.addEventListener('DOMContentLoaded', () => setPanelMotion('hidden'), { once: true })
let panelMotionRevision = 0
ipcRenderer.on('panel:motion', (_event, phase: 'shown' | 'hiding', waitForPaint: boolean) => {
  const revision = ++panelMotionRevision
  if (phase === 'shown' && waitForPaint) {
    // 首次显示要先绘制隐藏态，否则过渡会被 Chromium 合并而直接跳到终点。
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (revision === panelMotionRevision) setPanelMotion('shown')
      }),
    )
  } else {
    setPanelMotion(phase)
  }
})

// 只暴露应用定义的接口，渲染进程不直接访问 Node.js 或完整 IPC。
const api: Readonly<ScreenToolsApi> = {
  platform: process.platform,
  version,
  async quitApp() {
    await ipcRenderer.invoke('app:quit')
  },
  async confirmInputSourceSwitch() {
    return ipcRenderer.invoke('app:confirm-input-source') as Promise<boolean>
  },
  async getUpdateState() {
    return ipcRenderer.invoke('update:state') as Promise<UpdateState>
  },
  async checkForUpdates() {
    return ipcRenderer.invoke('update:check') as Promise<UpdateState>
  },
  async downloadUpdate() {
    return ipcRenderer.invoke('update:download') as Promise<UpdateState>
  },
  async installUpdate() {
    await ipcRenderer.invoke('update:install')
  },
  async openUpdatePage() {
    await ipcRenderer.invoke('update:open-release')
  },
  onUpdateChanged(listener) {
    const handler = (_event: Electron.IpcRendererEvent, state: UpdateState): void => listener(state)
    ipcRenderer.on('update:changed', handler)
    return () => ipcRenderer.removeListener('update:changed', handler)
  },
  onControlChanged(listener) {
    const handler = (): void => listener()
    ipcRenderer.on('controls:changed', handler)
    return () => ipcRenderer.removeListener('controls:changed', handler)
  },
  async getControlState() {
    return ipcRenderer.invoke('controls:state') as Promise<ControlState>
  },
  async executeControl(command) {
    return ipcRenderer.invoke('controls:execute', command) as Promise<ControlState>
  },
  async getDisplaySnapshot() {
    return ipcRenderer.invoke(displayChannels.snapshot) as Promise<DisplaySnapshot>
  },
  onDisplaysChanged(listener) {
    const handler = (): void => listener()
    ipcRenderer.on(displayChannels.changed, handler)
    return () => {
      ipcRenderer.removeListener(displayChannels.changed, handler)
    }
  },
}

contextBridge.exposeInMainWorld('screenTools', api)
