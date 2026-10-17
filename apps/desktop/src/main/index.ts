import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { createScreenToolsCore } from './core/screentools-core'
import type { ScreenToolsCore } from './core/screentools-core'
import { registerIpcHandlers } from './ipc'
import { registerControlIpc } from './ipc'
import { createControlService } from './services/control-service'
import type { ControlService } from './services/control-service'
import type { Tray } from 'electron'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null
let core: ScreenToolsCore | null = null
let unregisterIpc: (() => void) | undefined
let control: ControlService | undefined
let tray: Tray | undefined
let unregisterControl: (() => void) | undefined
let stopDisplaySubscription: (() => void) | undefined
let quitting = false
let disposed = false

function showMainWindow(): void {
  if (!app.isReady()) return

  if (!mainWindow) {
    mainWindow = createMainWindow(() => !quitting && (control?.state.settings.closeToTray ?? false))
    mainWindow.on('closed', () => {
      mainWindow = null
    })
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// 隔离开发与正式版本的数据目录，避免缓存和单实例锁冲突；显式指定的目录优先。
if (is.dev && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  void app
    .whenReady()
    .then(async () => {
      electronApp.setAppUserModelId('com.screentools.desktop')

      // 开发环境支持 F12 调试，正式环境禁用刷新快捷键。
      app.on('browser-window-created', (_event, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      core = createScreenToolsCore()
      unregisterIpc = registerIpcHandlers(core, () => mainWindow)
      control = createControlService(
        app.getPath('userData'),
        () => {
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('controls:changed')
        },
        showMainWindow,
      )
      unregisterControl = registerControlIpc(control, () => mainWindow)
      stopDisplaySubscription = core.subscribe(() => {
        void control?.onDisplaysChanged().catch(console.error)
      })
      tray = createTray(control, showMainWindow, () => app.quit())
      showMainWindow()
      await control.init()
      app.on('activate', showMainWindow)
    })
    .catch((error: unknown) => {
      console.error('应用启动失败：', error)
      app.exit(1)
    })

  // macOS 关闭窗口后保留应用，可通过 Dock 再次打开。
  app.on('before-quit', (event) => {
    quitting = true
    if (disposed) return
    event.preventDefault()
    disposed = true
    unregisterIpc?.()
    unregisterControl?.()
    stopDisplaySubscription?.()
    core?.dispose()
    tray?.destroy()
    void control
      ?.dispose()
      .catch(console.error)
      .finally(() => setImmediate(() => app.quit()))
    if (!control) setImmediate(() => app.quit())
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
