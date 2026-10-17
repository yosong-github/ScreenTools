import { contextBridge } from 'electron'
import type { ScreenToolsApi } from '@screentools/contracts'

const api: ScreenToolsApi = {
  platform: process.platform,
  version: '0.1.0',
}

contextBridge.exposeInMainWorld('screenTools', api)
