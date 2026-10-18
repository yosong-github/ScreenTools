import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultSettings } from '@screentools/contracts'

const api = vi.hoisted(() => ({
  executeControl: vi.fn(),
  getControlState: vi.fn(),
  onControlChanged: vi.fn((_listener: () => void) => () => {}),
}))
vi.mock('../src/renderer/src/api/screen-tools', () => ({ screenTools: api }))

import { useControlsStore } from '../src/renderer/src/stores/controls'

describe('控制状态缓存', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('普通操作直接使用命令返回状态，不额外读取一次', async () => {
    const next = {
      devices: [],
      profiles: [],
      settings: defaultSettings,
      capabilities: {},
      pending: null,
      screenFilter: { available: true, active: 'off' as const, reason: null },
      error: null,
      logs: [],
    }
    api.executeControl.mockResolvedValue(next)
    const store = useControlsStore()
    expect(await store.execute({ type: 'refresh' })).toBe(true)
    expect(store.state).toBe(next)
    expect(api.executeControl).toHaveBeenCalledOnce()
    expect(api.getControlState).not.toHaveBeenCalled()
  })

  it('操作中的状态通知不触发重复读取', async () => {
    const next = {
      devices: [],
      profiles: [],
      settings: defaultSettings,
      capabilities: {},
      pending: null,
      screenFilter: { available: true, active: 'off' as const, reason: null },
      error: null,
      logs: [],
    }
    api.getControlState.mockResolvedValue(next)
    api.executeControl.mockResolvedValue(next)
    const store = useControlsStore()
    store.start()
    const notify = api.onControlChanged.mock.calls[0]![0]
    await Promise.resolve()
    api.getControlState.mockClear()
    const pending = store.execute({ type: 'refresh' })
    notify()
    await pending
    expect(api.getControlState).not.toHaveBeenCalled()
    store.stop()
  })
})
