import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
  },
  shell: { openExternal: vi.fn() },
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { hideTrayWindow, showTrayWindow, toggleTrayWindow } from '../src/main/window'

function mockWindow(): BrowserWindow {
  let visible = false
  let bounds = { x: 0, y: 0, width: 460, height: 820 }
  return {
    isDestroyed: () => false,
    isVisible: () => visible,
    getBounds: () => bounds,
    setBounds: vi.fn((next) => {
      bounds = next
    }),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    show: vi.fn(() => {
      visible = true
    }),
    hide: vi.fn(() => {
      visible = false
    }),
    moveTop: vi.fn(),
    focus: vi.fn(),
    webContents: { isLoading: () => false, send: vi.fn() },
  } as unknown as BrowserWindow
}

describe('托盘面板动画', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('只设置一次窗口位置，由渲染层完成显示和隐藏过渡', () => {
    const window = mockWindow()
    showTrayWindow(window)
    expect(window.setBounds).toHaveBeenCalledExactlyOnceWith(
      { x: 1448, y: 248, width: 460, height: 820 },
      false,
    )
    expect(window.webContents.send).toHaveBeenLastCalledWith('panel:motion', 'shown', true)
    vi.advanceTimersByTime(214)
    expect(window.setBounds).toHaveBeenCalledTimes(1)

    hideTrayWindow(window)
    expect(window.webContents.send).toHaveBeenLastCalledWith('panel:motion', 'hiding', false)
    vi.advanceTimersByTime(159)
    expect(window.hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(window.hide).toHaveBeenCalledOnce()
  })

  it('收起过程中再次打开会取消隐藏，并保持点击切换语义', () => {
    const window = mockWindow()
    toggleTrayWindow(window)
    toggleTrayWindow(window)
    expect(window.webContents.send).toHaveBeenLastCalledWith('panel:motion', 'hiding', false)

    vi.advanceTimersByTime(50)
    toggleTrayWindow(window)
    expect(window.webContents.send).toHaveBeenLastCalledWith('panel:motion', 'shown', false)
    vi.advanceTimersByTime(200)
    expect(window.hide).not.toHaveBeenCalled()

    toggleTrayWindow(window)
    vi.advanceTimersByTime(160)
    expect(window.hide).toHaveBeenCalledOnce()
  })
})
