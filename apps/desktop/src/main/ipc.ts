import { dialog, ipcMain } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { displayChannels } from '@screentools/contracts'
import type { ControlCommand } from '@screentools/contracts'
import type { ScreenToolsCore } from './core/screentools-core'
import type { ControlService } from './services/control-service'
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
