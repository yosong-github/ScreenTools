import { describe, expect, it, vi } from 'vitest'
import { dialog } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { ScreenToolsCore } from '../src/main/core/screentools-core'
import { setPanelModalOpen } from '../src/main/window'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  dialog: { showMessageBox: vi.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}))
vi.mock('../src/main/window', () => ({ setPanelModalOpen: vi.fn() }))
import { registerAppIpc, registerControlIpc, registerIpcHandlers } from '../src/main/ipc'
import { defaultSettings } from '@screentools/contracts'
import type { ControlService } from '../src/main/services/control-service'

describe('IPC 边界', () => {
  it('只允许面板顶层页面请求退出应用', () => {
    const frame = {}
    const webContents = { mainFrame: frame }
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    const quit = vi.fn()
    const cleanup = registerAppIpc(() => window, quit)
    const handler = handlers.get('app:quit')!
    try {
      expect(() => handler({ sender: {}, senderFrame: frame })).toThrow('不允许的 IPC 来源')
      expect(() => handler({ sender: webContents, senderFrame: {} })).toThrow('不允许的 IPC 来源')
      expect(quit).not.toHaveBeenCalled()
      handler({ sender: webContents, senderFrame: frame })
      expect(quit).toHaveBeenCalledOnce()
    } finally {
      cleanup()
    }
    expect(handlers.size).toBe(0)
  })
  it('输入源确认框使用应用标题和警告图标，并以取消为默认操作', async () => {
    const frame = {}
    const webContents = { mainFrame: frame }
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    const cleanup = registerAppIpc(() => window, vi.fn())
    const handler = handlers.get('app:confirm-input-source')!
    const event = { sender: webContents, senderFrame: frame }
    try {
      await expect(handler({ sender: {}, senderFrame: frame })).rejects.toThrow('不允许的 IPC 来源')
      expect(dialog.showMessageBox).not.toHaveBeenCalled()
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
        response: 0,
        checkboxChecked: false,
      })
      await expect(handler(event)).resolves.toBe(false)
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        window,
        expect.objectContaining({
          type: 'warning',
          title: 'ScreenTools · 切换输入源',
          buttons: ['取消', '继续切换'],
          defaultId: 0,
          cancelId: 0,
        }),
      )
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
        response: 1,
        checkboxChecked: false,
      })
      await expect(handler(event)).resolves.toBe(true)
      expect(setPanelModalOpen).toHaveBeenCalledWith(window, true)
      expect(setPanelModalOpen).toHaveBeenLastCalledWith(window, false)
    } finally {
      cleanup()
    }
    expect(handlers.size).toBe(0)
  })
  it('控制命令限制来源并直接传递，读取缓存不触发递归刷新', async () => {
    const frame = {}
    const webContents = { mainFrame: frame }
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    const state = {
      devices: [],
      profiles: [],
      settings: defaultSettings,
      capabilities: {},
      pending: null,
      error: null,
      logs: [],
    }
    const execute = vi.fn().mockResolvedValue(state)
    const refresh = vi.fn()
    const service = { state, execute, refresh } as unknown as ControlService
    const cleanup = registerControlIpc(service, () => window)
    const event = { sender: webContents, senderFrame: frame }
    try {
      const command = handlers.get('controls:execute')!
      await expect(
        command({ sender: {}, senderFrame: frame }, { type: 'refresh' }),
      ).rejects.toThrow('不允许')
      expect(execute).not.toHaveBeenCalled()
      await expect(handlers.get('controls:state')!(event)).resolves.toEqual(state)
      expect(refresh).not.toHaveBeenCalled()
      await expect(command(event, { type: 'refresh' })).resolves.toEqual(state)
      expect(execute).toHaveBeenCalledWith({ type: 'refresh' })
      const unvalidated = { ...state, devices: 'unvalidated' }
      execute.mockResolvedValueOnce(unvalidated)
      await expect(command(event, { type: 'refresh' })).resolves.toBe(unvalidated)
    } finally {
      cleanup()
    }
    expect(handlers.size).toBe(0)
  })
  it('拒绝陌生窗口和子框架，直接返回快照并清理处理器', async () => {
    const frame = {}
    const webContents = { mainFrame: frame, send: vi.fn() }
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    const unsubscribe = vi.fn()
    const core: ScreenToolsCore = {
      getDisplaySnapshot: vi.fn().mockResolvedValue({
        source: 'electron-screen',
        identity: 'session',
        capturedAt: new Date().toISOString(),
        displays: [],
      }),
      subscribe: () => unsubscribe,
      dispose: vi.fn(),
    }
    const cleanup = registerIpcHandlers(core, () => window)
    const handler = handlers.get('displays:snapshot')!
    const event = { sender: webContents, senderFrame: frame } as unknown as IpcMainInvokeEvent
    try {
      await expect(handler({ sender: {}, senderFrame: frame })).rejects.toThrow('不允许的 IPC 来源')
      await expect(handler({ sender: webContents, senderFrame: {} })).rejects.toThrow(
        '不允许的 IPC 来源',
      )
      expect(core.getDisplaySnapshot).not.toHaveBeenCalled()
      await expect(handler(event)).resolves.toMatchObject({ displays: [] })
      vi.mocked(core.getDisplaySnapshot).mockResolvedValueOnce({ displays: 'invalid' } as never)
      await expect(handler(event)).resolves.toEqual({ displays: 'invalid' })
    } finally {
      cleanup()
    }
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(handlers.size).toBe(0)
  })
})
