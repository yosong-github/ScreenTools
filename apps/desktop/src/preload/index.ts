import { contextBridge, ipcRenderer } from 'electron'
import { displayChannels } from '@screentools/contracts'
import type { ScreenToolsApi, ControlState, DisplaySnapshot } from '@screentools/contracts'
import { version } from '../../package.json'

// 只暴露应用定义的接口，渲染进程不直接访问 Node.js 或完整 IPC。
const api: Readonly<ScreenToolsApi> = {
  platform: process.platform,
  version,
  async hidePanel() {
    await ipcRenderer.invoke('panel:hide')
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
