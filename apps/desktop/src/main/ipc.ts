import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { displayChannels } from '@screentools/contracts'
import type { ControlCommand } from '@screentools/contracts'
import type { ScreenToolsCore } from './core/screentools-core'
import type { ControlService } from './services/control-service'

export function registerAppIpc(
  getWindow: () => BrowserWindow | null,
  quit: () => void,
): () => void {
  ipcMain.handle('app:quit', (event) => {
    const window = getWindow()
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('不允许的 IPC 来源')
    }
    quit()
  })
  return () => ipcMain.removeHandler('app:quit')
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
