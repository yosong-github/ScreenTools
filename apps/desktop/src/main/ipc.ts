import { dialog, ipcMain } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { displayChannels } from '@screentools/contracts'
import type { ControlCommand, EnhanceCrop, EnhanceWindow } from '@screentools/contracts'
import type { ScreenToolsCore } from './core/screentools-core'
import type { ControlService } from './services/control-service'
import type { EnhanceService } from './services/enhance-service'
import { isEnhancePreset } from './services/enhance-scripts'
import type { UpdateService } from './services/update-service'
import { setPanelModalOpen } from './window'

export function registerAppIpc(
  getWindow: () => BrowserWindow | null,
  quit: () => void,
): () => void {
  const trustedWindow = (event: IpcMainInvokeEvent): BrowserWindow => {
    const window = getWindow()
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('不允许的 IPC 来源')
    }
    return window
  }
  ipcMain.handle('app:quit', (event) => {
    trustedWindow(event)
    quit()
  })
  ipcMain.handle('app:confirm-input-source', async (event) => {
    const window = trustedWindow(event)
    setPanelModalOpen(window, true)
    try {
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        title: 'ScreenTools · 切换输入源',
        message: '确定切换显示器输入源？',
        detail:
          '切换后屏幕可能断开，ScreenTools 无法自动恢复。请确认你能使用显示器实体按键切回原输入源。',
        buttons: ['取消', '继续切换'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      return response === 1
    } finally {
      setPanelModalOpen(window, false)
    }
  })
  return () => {
    ipcMain.removeHandler('app:quit')
    ipcMain.removeHandler('app:confirm-input-source')
  }
}

export function registerIpcHandlers(
  core: ScreenToolsCore,
  getWindow: () => BrowserWindow | null,
): () => void {
  ipcMain.handle(displayChannels.snapshot, async (event) => {
    const window = getWindow()
    // 只接受本应用主窗口的顶层页面，不允许子框架或其他窗口调用。
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('不允许的 IPC 来源')
    }
    return core.getDisplaySnapshot()
  })
  const unsubscribe = core.subscribe(() => {
    const window = getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(displayChannels.changed)
  })
  return () => {
    unsubscribe()
    ipcMain.removeHandler(displayChannels.snapshot)
  }
}

export function registerControlIpc(
  service: ControlService,
  getWindow: () => BrowserWindow | null,
): () => void {
  for (const channel of ['controls:state', 'controls:execute']) {
    ipcMain.handle(channel, async (event, command: ControlCommand) => {
      const window = getWindow()
      if (
        !window ||
        window.isDestroyed() ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error('不允许的 IPC 来源')
      if (channel === 'controls:state') {
        return service.state
      }
      return service.execute(command)
    })
  }
  return () => {
    ipcMain.removeHandler('controls:state')
    ipcMain.removeHandler('controls:execute')
  }
}

export function registerEnhanceIpc(
  service: EnhanceService,
  getWindow: () => BrowserWindow | null,
): () => void {
  const trusted = (event: IpcMainInvokeEvent): void => {
    const window = getWindow()
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error('不允许的 IPC 来源')
  }
  const handlers: Record<string, (argument?: unknown) => unknown> = {
    'enhance:state': () => service.state,
    'enhance:list-windows': () => service.listWindows(),
    'enhance:capture-window': (hwnd) =>
      service.captureWindowSnapshot(typeof hwnd === 'number' ? hwnd : 0),
    'enhance:start-window': (payload) => {
      const { target, crop } = (payload ?? {}) as { target?: unknown; crop?: unknown }
      if (!target || typeof target !== 'object') return service.state
      const value = target as Partial<EnhanceWindow>
      if (typeof value.hwnd !== 'number') return service.state
      let cropValue: EnhanceCrop | undefined
      if (crop && typeof crop === 'object') {
        const candidate = crop as Partial<EnhanceCrop>
        if (
          typeof candidate.x === 'number' &&
          typeof candidate.y === 'number' &&
          typeof candidate.width === 'number' &&
          typeof candidate.height === 'number'
        )
          cropValue = candidate as EnhanceCrop
      }
      return service.startWindowEnhance(value as EnhanceWindow, cropValue)
    },
    'enhance:toggle-window': () => service.toggleWindowEnhance(),
    'enhance:stop-window': () => service.stopWindowEnhance(),
    'enhance:choose-component': () => service.chooseComponent(),
    'enhance:open-video': (file) =>
      service.openVideo(typeof file === 'string' && file.trim() ? file : undefined),
    'enhance:stop': () => service.stopPlayback(),
    'enhance:set-preset': (preset) =>
      isEnhancePreset(preset) ? service.setPreset(preset) : service.state,
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, argument: unknown) => {
      trusted(event)
      return handler(argument)
    })
  }
  return () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  }
}

export function registerUpdateIpc(
  service: UpdateService,
  getWindow: () => BrowserWindow | null,
): () => void {
  const handlers = {
    'update:state': () => service.state,
    'update:check': () => service.check(),
    'update:download': () => service.download(),
    'update:install': () => service.install(),
    'update:open-release': () => service.openReleasePage(),
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event) => {
      const window = getWindow()
      if (
        !window ||
        window.isDestroyed() ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error('不允许的 IPC 来源')
      return handler()
    })
  }
  return () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  }
}
