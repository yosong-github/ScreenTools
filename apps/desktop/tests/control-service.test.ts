import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@screentools/contracts'
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  rename: vi.fn(),
  register: vi.fn(() => true),
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
    request = mocks.request
    dispose = vi.fn()
    terminateReadWorker = vi.fn()
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
