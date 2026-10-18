import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { ScreenToolsCore } from '../src/main/core/screentools-core'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}))
import { registerControlIpc, registerIpcHandlers, registerPanelIpc } from '../src/main/ipc'
import { defaultSettings } from '@screentools/contracts'
import type { ControlService } from '../src/main/services/control-service'

describe('IPC 边界', () => {
  it('只允许面板顶层页面请求隐藏窗口', () => {
    const frame = {}
    const webContents = { mainFrame: frame }
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    const hide = vi.fn()
    const cleanup = registerPanelIpc(() => window, hide)
    const handler = handlers.get('panel:hide')!
    try {
      expect(() => handler({ sender: {}, senderFrame: frame })).toThrow('不允许的 IPC 来源')
      expect(() => handler({ sender: webContents, senderFrame: {} })).toThrow('不允许的 IPC 来源')
      expect(hide).not.toHaveBeenCalled()
      handler({ sender: webContents, senderFrame: frame })
      expect(hide).toHaveBeenCalledExactlyOnceWith(window)
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
