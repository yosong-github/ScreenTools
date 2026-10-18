import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import type { Rectangle } from 'electron'
import { is } from '@electron-toolkit/utils'

const PANEL_WIDTH = 460
const PANEL_HEIGHT = 820
const PANEL_EDGE_GAP = 12
const PANEL_MOTION_DISTANCE = 28
const SHOW_DURATION = 180
const HIDE_DURATION = 140

type PanelPhase = 'hidden' | 'showing' | 'shown' | 'hiding'
type Point = { x: number; y: number }
interface PanelMotionState {
  phase: PanelPhase
  hideSource?: 'blur' | 'click'
  timer: ReturnType<typeof setInterval> | undefined
  readyHandler: (() => void) | undefined
  pointerGuardTimer: ReturnType<typeof setInterval> | undefined
  blurTimer: ReturnType<typeof setTimeout> | undefined
  target?: Point
  activationPoint?: Point
}

const panelMotion = new WeakMap<BrowserWindow, PanelMotionState>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 像 Windows 快捷设置一样固定在工作区右下角，不依赖托盘图标是否可见。 */
export function getSystemPanelPosition(
  workArea: Rectangle,
  panelSize: { width: number; height: number } = { width: PANEL_WIDTH, height: PANEL_HEIGHT },
): { x: number; y: number } {
  const maxX = workArea.x + Math.max(0, workArea.width - panelSize.width)
  const maxY = workArea.y + Math.max(0, workArea.height - panelSize.height)
  return {
    x: clamp(maxX - PANEL_EDGE_GAP, workArea.x, maxX),
    y: clamp(maxY - PANEL_EDGE_GAP, workArea.y, maxY),
  }
}

function getMotionState(window: BrowserWindow): PanelMotionState {
  let state = panelMotion.get(window)
  if (!state) {
    state = {
      phase: 'hidden',
      timer: undefined,
      readyHandler: undefined,
      pointerGuardTimer: undefined,
      blurTimer: undefined,
    }
    panelMotion.set(window, state)
  }
  return state
}

function stopPointerGuard(window: BrowserWindow, state: PanelMotionState): void {
  if (state.pointerGuardTimer) clearInterval(state.pointerGuardTimer)
  state.pointerGuardTimer = undefined
  delete state.activationPoint
  if (!window.isDestroyed()) window.setIgnoreMouseEvents(false)
}

function startPointerGuard(window: BrowserWindow, state: PanelMotionState, target: Point): void {
  const point = state.activationPoint
  if (!point || process.platform !== 'win32') return
  const bounds = window.getBounds()
  if (
    point.x < target.x ||
    point.x >= target.x + bounds.width ||
    point.y < target.y ||
    point.y >= target.y + bounds.height
  ) {
    delete state.activationPoint
    return
  }

  // 隐藏图标区域可能正好被面板覆盖。让原地的下一次点击到达下方的托盘图标。
  window.setIgnoreMouseEvents(true, { forward: true })
  state.pointerGuardTimer = setInterval(() => {
    if (window.isDestroyed()) {
      clearInterval(state.pointerGuardTimer)
      state.pointerGuardTimer = undefined
      return
    }
    const cursor = screen.getCursorScreenPoint()
    if (Math.hypot(cursor.x - point.x, cursor.y - point.y) > 12) stopPointerGuard(window, state)
  }, 16)
}

function stopAnimation(state: PanelMotionState): void {
  if (state.timer) clearInterval(state.timer)
  state.timer = undefined
}

function animateWindow(
  window: BrowserWindow,
  state: PanelMotionState,
  from: { y: number; opacity: number },
  to: { y: number; opacity: number },
  duration: number,
  easing: (progress: number) => number,
  done: () => void,
): void {
  stopAnimation(state)
  const startedAt = Date.now()
  const tick = (): void => {
    if (window.isDestroyed()) {
      stopAnimation(state)
      return
    }
    const progress = Math.min(1, (Date.now() - startedAt) / duration)
    const eased = easing(progress)
    const y = Math.round(from.y + (to.y - from.y) * eased)
    const opacity = from.opacity + (to.opacity - from.opacity) * eased
    window.setPosition(window.getBounds().x, y, false)
    window.setOpacity(opacity)
    if (progress === 1) {
      stopAnimation(state)
      done()
    }
  }

  tick()
  state.timer = setInterval(tick, 16)
}

export function showTrayWindow(window: BrowserWindow): void {
  const state = getMotionState(window)
  if (state.blurTimer) clearTimeout(state.blurTimer)
  state.blurTimer = undefined
  if ((state.phase === 'shown' || state.phase === 'showing') && window.isVisible()) {
    window.moveTop()
    window.focus()
    return
  }
  const show = (): void => {
    if (window.isDestroyed()) return
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const panelSize = {
      width: Math.min(PANEL_WIDTH, display.workArea.width),
      height: Math.min(PANEL_HEIGHT, display.workArea.height),
    }
    window.setSize(panelSize.width, panelSize.height, false)
    const target = getSystemPanelPosition(display.workArea, panelSize)
    const wasVisible = window.isVisible()
    const current = window.getBounds()
    const from = {
      y: wasVisible ? current.y : target.y + PANEL_MOTION_DISTANCE,
      opacity: wasVisible ? window.getOpacity() : 0,
    }
    state.phase = 'showing'
    delete state.hideSource
    state.target = target
    window.setPosition(target.x, from.y, false)
    window.setOpacity(from.opacity)
    // Windows 的隐藏图标面板本身是置顶浮层，需要使用弹出菜单级别才能显示在它上方。
    window.setAlwaysOnTop(true, 'pop-up-menu')
    window.show()
    window.moveTop()
    window.focus()
    startPointerGuard(window, state, target)
    animateWindow(
      window,
      state,
      from,
      { y: target.y, opacity: 1 },
      SHOW_DURATION,
      (progress) => 1 - Math.pow(1 - progress, 3),
      () => {
        state.phase = 'shown'
      },
    )
  }

  if (window.webContents.isLoading()) {
    state.phase = 'showing'
    if (!state.readyHandler) {
      state.readyHandler = (): void => {
        state.readyHandler = undefined
        if (state.phase === 'showing') show()
      }
      window.once('ready-to-show', state.readyHandler)
    }
  } else show()
}

export function hideTrayWindow(window: BrowserWindow, source: 'blur' | 'click' = 'click'): void {
  const state = getMotionState(window)
  if (state.blurTimer) clearTimeout(state.blurTimer)
  state.blurTimer = undefined
  stopPointerGuard(window, state)
  if (state.phase === 'hiding') return
  if (state.readyHandler) {
    window.removeListener('ready-to-show', state.readyHandler)
    state.readyHandler = undefined
  }
  if (!window.isVisible()) {
    stopAnimation(state)
    state.phase = 'hidden'
    return
  }

  const current = window.getBounds()
  const targetY = (state.target?.y ?? current.y) + PANEL_MOTION_DISTANCE
  state.phase = 'hiding'
  state.hideSource = source
  animateWindow(
    window,
    state,
    { y: current.y, opacity: window.getOpacity() },
    { y: targetY, opacity: 0 },
    HIDE_DURATION,
    (progress) => progress * progress * progress,
    () => {
      window.hide()
      window.setOpacity(1)
      state.phase = 'hidden'
      delete state.hideSource
    },
  )
}

export function toggleTrayWindow(window: BrowserWindow): void {
  const state = getMotionState(window)
  if (state.blurTimer) clearTimeout(state.blurTimer)
  state.blurTimer = undefined
  // 托盘点击本身会先让面板失焦；失焦已触发收起时，不把该点击误判为重新打开。
  if (state.phase === 'hiding' && state.hideSource === 'blur') return
  if (state.phase === 'shown' || state.phase === 'showing') {
    hideTrayWindow(window)
  } else {
    // 记住托盘点击位置，判断面板是否覆盖了隐藏图标。
    state.activationPoint = screen.getCursorScreenPoint()
    showTrayWindow(window)
  }
}

export function createTrayWindow(shouldClose: () => boolean = () => false): BrowserWindow {
  const window = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // 圆角由页面绘制，避免 Windows 的原生边框/阴影在透明角落留下矩形底色。
    hasShadow: false,
    roundedCorners: false,
    thickFrame: false,
    autoHideMenuBar: true,
    title: 'ScreenTools',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 托盘面板只隐藏、不销毁，状态与原生服务可持续工作。
  window.on('close', (event) => {
    if (shouldClose()) return
    event.preventDefault()
    hideTrayWindow(window)
  })
  window.on('focus', () => {
    const state = getMotionState(window)
    if (state.blurTimer) clearTimeout(state.blurTimer)
    state.blurTimer = undefined
  })
  window.on('blur', () => {
    const state = getMotionState(window)
    if (state.blurTimer) clearTimeout(state.blurTimer)
    // 透传时先等托盘 click 完成；若下方没有图标，失焦后仍自动收起。
    state.blurTimer = setTimeout(
      () => {
        state.blurTimer = undefined
        if (!window.isDestroyed() && !window.isFocused()) hideTrayWindow(window, 'blur')
      },
      state.pointerGuardTimer ? 350 : 100,
    )
  })
  // 页面导航只能由应用主动发起，避免外部页面获得预加载接口。
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.on('closed', () => {
    const state = getMotionState(window)
    stopAnimation(state)
    if (state.pointerGuardTimer) clearInterval(state.pointerGuardTimer)
    if (state.blurTimer) clearTimeout(state.blurTimer)
  })
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
