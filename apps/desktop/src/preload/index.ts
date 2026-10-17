import { contextBridge } from 'electron'
import type { ScreenToolsApi } from '@screentools/contracts'
import { version } from '../../package.json'

// 只暴露应用定义的接口，渲染进程不直接访问 Node.js 或完整 IPC。
const api: Readonly<ScreenToolsApi> = {
  platform: process.platform,
  version,
}

contextBridge.exposeInMainWorld('screenTools', api)
