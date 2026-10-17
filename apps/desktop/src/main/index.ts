import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

function showMainWindow(): void {
  if (!app.isReady()) return

  if (!mainWindow) {
    mainWindow = createMainWindow()
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
    .then(() => {
      electronApp.setAppUserModelId('com.screentools.desktop')

      // 开发环境支持 F12 调试，正式环境禁用刷新快捷键。
      app.on('browser-window-created', (_event, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      showMainWindow()
      app.on('activate', showMainWindow)
    })
    .catch((error: unknown) => {
      console.error('应用启动失败：', error)
      app.exit(1)
    })

  // macOS 关闭窗口后保留应用，可通过 Dock 再次打开。
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
