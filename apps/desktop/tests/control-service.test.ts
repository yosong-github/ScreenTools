import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@screentools/contracts'
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  rename: vi.fn(),
  register: vi.fn(() => true),
  created: vi.fn(),
  terminate: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: mocks.read,
  writeFile: mocks.write,
  rename: mocks.rename,
}))
vi.mock('electron', () => ({
  app: { isPackaged: false, setLoginItemSettings: vi.fn(), getVersion: () => 'test' },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  globalShortcut: {
    register: mocks.register,
    unregister: vi.fn(),
    isRegistered: () => false,
    unregisterAll: vi.fn(),
  },
}))
vi.mock('../src/main/services/native-client', () => ({
  NativeClient: class {
    constructor() {
      mocks.created()
    }
    request = mocks.request
    dispose = vi.fn()
    terminateReadWorker = mocks.terminate
  },
}))
import { createControlService } from '../src/main/services/control-service'
const device = {
  id: 'test',
  name: '屏幕',
  connection: 'HDMI',
  mode: { width: 1920, height: 1080, refreshRate: 60 },
  modes: [],
  x: 0,
  y: 0,
  rotation: 0 as const,
  primary: true,
  hdr: null,
}
describe('控制服务', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.read.mockRejectedValue(Object.assign(Error('missing'), { code: 'ENOENT' }))
    mocks.write.mockResolvedValue(undefined)
    mocks.rename.mockResolvedValue(undefined)
    mocks.request.mockImplementation(async (operation: string) =>
      operation === 'snapshot'
        ? [device]
        : operation === 'apply'
          ? { token: 'test-token', expiresAt: Date.now() + 20000 }
          : {},
    )
  })
  it('连续调亮度复用进程，不重新枚举模式，也不覆盖其他能力', async () => {
    const brightness = { min: 0, max: 100, current: 20 }
    const contrast = { min: 0, max: 100, current: 40 }
    mocks.request.mockImplementation(async (operation: string, payload?: { value: number }) =>
      operation === 'snapshot'
        ? [device]
        : operation === 'probe'
          ? { brightness, contrast }
          : { brightness: { ...brightness, current: payload!.value } },
    )
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      await service.execute({ type: 'probe', id: 'test' })
      const created = mocks.created.mock.calls.length
      mocks.request.mockClear()
      await service.execute({
        type: 'hardware',
        setting: { id: 'test', feature: 'brightness', value: 50 },
      })
      await service.execute({
        type: 'hardware',
        setting: { id: 'test', feature: 'brightness', value: 60 },
      })
      expect(mocks.created).toHaveBeenCalledTimes(created)
      expect(mocks.request.mock.calls.map((c) => c[0])).toEqual(['hardware', 'hardware'])
      expect(service.state.capabilities.test).toEqual({
        brightness: { ...brightness, current: 60 },
        contrast,
      })
    } finally {
      await service.dispose()
    }
  })
  it('超时回收进程、保留最后成功值，下一次操作重新创建进程', async () => {
    const brightness = { min: 0, max: 100, current: 20 }
    mocks.request.mockImplementation(async (operation: string) =>
      operation === 'snapshot' ? [device] : { brightness },
    )
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      await service.execute({ type: 'probe', id: 'test' })
      const created = mocks.created.mock.calls.length
      mocks.request.mockRejectedValueOnce(Error('设备响应超时'))
      await expect(
        service.execute({
          type: 'hardware',
          setting: { id: 'test', feature: 'brightness', value: 50 },
        }),
      ).rejects.toThrow('设备响应超时')
      expect(mocks.terminate).toHaveBeenCalledOnce()
      expect(service.state.capabilities.test?.brightness).toEqual(brightness)
      await service.execute({ type: 'probe', id: 'test' })
      expect(mocks.created).toHaveBeenCalledTimes(created + 1)
    } finally {
      await service.dispose()
    }
  })
  it('闲置 30 秒或设备断开时回收复用进程', async () => {
    vi.useFakeTimers()
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      await service.execute({ type: 'probe', id: 'test' })
      vi.advanceTimersByTime(29999)
      expect(mocks.terminate).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(mocks.terminate).toHaveBeenCalledOnce()
      await service.execute({ type: 'probe', id: 'test' })
      mocks.request.mockResolvedValueOnce([])
      await service.refresh()
      expect(mocks.terminate).toHaveBeenCalledTimes(2)
      expect(service.state.capabilities).toEqual({})
    } finally {
      await service.dispose()
    }
  })
  it('系统配置确认前不执行方案硬件写入', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    await service.init()
    await service.execute({
      type: 'apply',
      plan: { displays: [device], hardware: [{ id: 'test', feature: 'brightness', value: 50 }] },
    })
    expect(service.state.pending?.token).toBe('test-token')
    expect(mocks.request.mock.calls.some((c) => c[0] === 'hardware')).toBe(false)
    await expect(service.execute({ type: 'probe', id: 'test' })).rejects.toThrow('请先确认')
    await service.execute({ type: 'confirm', token: 'test-token' })
    expect(mocks.request).toHaveBeenCalledWith(
      'hardware',
      { id: 'test', feature: 'brightness', value: 50 },
      12000,
    )
    await service.dispose()
  })
  it('缺失设备和危险自动硬件方案不调用原生应用', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    await service.init()
    await expect(
      service.execute({
        type: 'apply',
        plan: { displays: [{ ...device, id: 'missing' }], hardware: [] },
      }),
    ).rejects.toThrow('未全部连接')
    await expect(
      service.execute({
        type: 'apply',
        plan: { displays: [], hardware: [{ id: 'test', feature: 'power', value: 5 }] },
      }),
    ).rejects.toThrow('禁止自动')
    expect(mocks.request.mock.calls.some((c) => c[0] === 'apply')).toBe(false)
    await service.dispose()
  })
  it('存储失败不保留虚假成功状态，损坏文件不覆盖', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    await service.init()
    mocks.rename.mockRejectedValueOnce(Object.assign(Error('private path'), { code: 'EACCES' }))
    await expect(
      service.execute({
        type: 'save-profile',
        profile: { id: 'p', name: '办公', plan: { displays: [], hardware: [] } },
      }),
    ).rejects.toThrow()
    expect(service.state.profiles).toEqual([])
    expect(service.state.logs.at(-1)?.message).not.toContain('private path')
    await service.dispose()
    mocks.read.mockResolvedValue('invalid json')
    const broken = createControlService('test-data', vi.fn(), vi.fn())
    await broken.init()
    await expect(broken.execute({ type: 'settings', settings: defaultSettings })).rejects.toThrow(
      '本地配置损坏',
    )
    expect(broken.state.settings).toEqual(defaultSettings)
    await broken.dispose()
  })
})
