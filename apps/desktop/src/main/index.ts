import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createTrayWindow, setPanelPinned, showTrayWindow, toggleTrayWindow } from './window'
import { createScreenToolsCore } from './core/screentools-core'
import type { ScreenToolsCore } from './core/screentools-core'
import {
  registerIpcHandlers,
  registerControlIpc,
  registerAppIpc,
  registerEnhanceIpc,
  registerUpdateIpc,
} from './ipc'
import { createControlService } from './services/control-service'
import type { ControlService } from './services/control-service'
import { EnhanceService } from './services/enhance-service'
import { UpdateService } from './services/update-service'
import type { Tray } from 'electron'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null
let core: ScreenToolsCore | null = null
let unregisterIpc: (() => void) | undefined
let control: ControlService | undefined
let tray: Tray | undefined
let unregisterControl: (() => void) | undefined
let unregisterApp: (() => void) | undefined
let unregisterUpdate: (() => void) | undefined
let unregisterEnhance: (() => void) | undefined
let updater: UpdateService | undefined
let enhance: EnhanceService | undefined
let stopDisplaySubscription: (() => void) | undefined
let quitting = false
let disposed = false

function showPanel(): void {
  if (!app.isReady()) return

  if (!mainWindow) {
    mainWindow = createTrayWindow(() => quitting)
    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  showTrayWindow(mainWindow)
}

function togglePanel(): void {
  if (!mainWindow) {
    showPanel()
    return
  }
  toggleTrayWindow(mainWindow)
}

// 隔离开发与正式版本的数据目录，避免缓存和单实例锁冲突；显式指定的目录优先。
if (is.dev && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showPanel)

  void app
    .whenReady()
    .then(async () => {
      electronApp.setAppUserModelId('com.screentools.desktop')

      // 开发环境支持 F12 调试，正式环境禁用刷新快捷键。
      app.on('browser-window-created', (_event, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      core = createScreenToolsCore()
      unregisterApp = registerAppIpc(
        () => mainWindow,
        () => app.quit(),
      )
      unregisterIpc = registerIpcHandlers(core, () => mainWindow)
      control = createControlService(
        app.getPath('userData'),
        () => {
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('controls:changed')
        },
        showPanel,
      )
      unregisterControl = registerControlIpc(control, () => mainWindow)
      enhance = new EnhanceService(
        app.getPath('userData'),
        (state) => {
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('enhance:changed', state)
        },
        () => mainWindow,
      )
      unregisterEnhance = registerEnhanceIpc(enhance, () => mainWindow)
      updater = new UpdateService((state) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send('update:changed', state)
      })
      unregisterUpdate = registerUpdateIpc(updater, () => mainWindow)
      stopDisplaySubscription = core.subscribe(() => {
        void control?.onDisplaysChanged().catch(console.error)
      })
      mainWindow = createTrayWindow(() => quitting)
      mainWindow.on('closed', () => {
        mainWindow = null
      })
      // 便携版/快捷方式可传 --show，窗口创建后立即弹出，不必等待原生服务初始化；
      // --enhance 会直接打开画质增强页，并保持面板展开。
      if (process.argv.includes('--show') || process.argv.includes('--enhance')) {
        setPanelPinned(true)
        showPanel()
      }
      tray = createTray(control, togglePanel, () => app.quit())
      await Promise.all([control.init(), enhance.init()])
      updater.start()
      app.on('activate', showPanel)
    })
    .catch((error: unknown) => {
      console.error('应用启动失败：', error)
      app.exit(1)
    })

  app.on('before-quit', (event) => {
    quitting = true
    if (disposed) return
    event.preventDefault()
    disposed = true
    unregisterIpc?.()
    unregisterControl?.()
    unregisterApp?.()
    unregisterUpdate?.()
    unregisterEnhance?.()
    updater?.stop()
    enhance?.dispose()
    stopDisplaySubscription?.()
    core?.dispose()
    tray?.destroy()
    void control
      ?.dispose()
      .catch(console.error)
      .finally(() => setImmediate(() => app.quit()))
    if (!control) setImmediate(() => app.quit())
  })

  // 托盘是应用的主入口；没有可见窗口时仍保持运行。
  app.on('window-all-closed', () => undefined)
}
