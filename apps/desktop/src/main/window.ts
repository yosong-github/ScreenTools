import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

export function createMainWindow(shouldHideOnClose: () => boolean = () => false): BrowserWindow {
  const window = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'ScreenTools',
    backgroundColor: '#101827',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 等待首帧准备完成后显示，避免启动闪烁。
  window.once('ready-to-show', () => window.show())
  window.on('close', (event) => {
    if (shouldHideOnClose()) {
      event.preventDefault()
      window.hide()
    }
  })
  // 页面导航只能由应用主动发起，避免外部页面获得预加载接口。
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('preload-error', (_event, path, error) => {
    console.error(`预加载脚本执行失败：${path}`, error)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    // 外部网页交给系统浏览器，拒绝其他协议。
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url).catch((error: unknown) => {
        console.error('打开外部链接失败：', error)
      })
    }
    return { action: 'deny' }
  })

  const loading =
    is.dev && process.env.ELECTRON_RENDERER_URL
      ? window.loadURL(process.env.ELECTRON_RENDERER_URL)
      : window.loadFile(join(__dirname, '../renderer/index.html'))

  void loading.catch((error: unknown) => {
    console.error('窗口页面加载失败：', error)
  })

  return window
}
