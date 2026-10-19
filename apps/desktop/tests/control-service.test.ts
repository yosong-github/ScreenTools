import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@screentools/contracts'
import { createCustomFilterMatrix, defaultCustomFilterSettings } from '@screentools/display-core'
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  rename: vi.fn(),
  register: vi.fn(() => true),
  created: vi.fn(),
  terminate: vi.fn(),
  loginItem: {
    isPackaged: false,
    get: vi.fn(() => ({ openAtLogin: false, executableWillLaunchAtLogin: false })),
    set: vi.fn(),
  },
}))
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: mocks.read,
  writeFile: mocks.write,
  rename: mocks.rename,
}))
vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.loginItem.isPackaged
    },
    getLoginItemSettings: mocks.loginItem.get,
    setLoginItemSettings: mocks.loginItem.set,
    getVersion: () => 'test',
  },
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
    mocks.register.mockReturnValue(true)
    mocks.loginItem.isPackaged = false
    mocks.loginItem.get.mockReturnValue({
      openAtLogin: false,
      executableWillLaunchAtLogin: false,
    })
    mocks.read.mockRejectedValue(Object.assign(Error('missing'), { code: 'ENOENT' }))
    mocks.write.mockResolvedValue(undefined)
    mocks.rename.mockResolvedValue(undefined)
    mocks.request.mockImplementation(async (operation: string) =>
      operation === 'snapshot'
        ? [device]
        : operation === 'probe'
          ? { brightness: { min: 0, max: 100, current: 20 } }
          : operation === 'screen-filter-status'
            ? { available: true, active: 'off', reason: null }
            : operation === 'apply'
              ? { token: 'test-token', expiresAt: Date.now() + 20000 }
              : {},
    )
  })
  it('连续调亮度复用进程，不重新枚举模式，也不覆盖其他能力', async () => {
    const brightness = { min: 0, max: 100, current: 20 }
    const contrast = { min: 0, max: 100, current: 40 }
    mocks.request.mockImplementation(
      async (operation: string, payload?: { setting?: { value: number } }) =>
        operation === 'snapshot'
          ? [device]
          : operation === 'probe'
            ? { brightness, contrast }
            : { brightness: { ...brightness, current: payload!.setting?.value } },
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
      {
        setting: { id: 'test', feature: 'brightness', value: 50 },
        capability: { min: 0, max: 100, current: 20 },
      },
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
  it('普通操作使用缓存，定时轮询只读取已知硬件参数', async () => {
    vi.useFakeTimers()
    const brightness = { min: 0, max: 100, current: 20 }
    mocks.request.mockImplementation(async (operation: string) =>
      operation === 'snapshot'
        ? [device]
        : operation === 'probe'
          ? { brightness }
          : operation === 'poll-hardware'
            ? { brightness: { ...brightness, current: 35 } }
            : {},
    )
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      expect(mocks.request.mock.calls.map((call) => call[0])).toEqual([
        'snapshot',
        'probe',
        'screen-filter-status',
      ])
      mocks.request.mockClear()
      await service.execute({
        type: 'hardware',
        setting: { id: 'test', feature: 'brightness', value: 30 },
      })
      await service.execute({
        type: 'save-profile',
        profile: { id: 'p', name: '办公', plan: { displays: [], hardware: [] } },
      })
      expect(mocks.request.mock.calls.map((call) => call[0])).toEqual(['hardware'])
      await vi.advanceTimersByTimeAsync(60_000)
      expect(mocks.request.mock.calls.map((call) => call[0])).toEqual([
        'hardware',
        'snapshot',
        'poll-hardware',
      ])
      expect(service.state.capabilities.test?.brightness?.current).toBe(35)
    } finally {
      await service.dispose()
    }
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
  it('全新安装默认开启开机自启动，并在保存失败时恢复系统设置', async () => {
    mocks.loginItem.isPackaged = true
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      expect(service.state.launchAtLoginAvailable).toBe(true)
      // 无配置文件时按默认设置开启，并同步到系统。
      expect(service.state.settings.launchAtLogin).toBe(true)
      expect(mocks.loginItem.set).toHaveBeenCalledWith({ openAtLogin: true })

      await service.execute({
        type: 'settings',
        settings: { ...service.state.settings, launchAtLogin: false },
      })
      expect(mocks.loginItem.set).toHaveBeenLastCalledWith({ openAtLogin: false })
      expect(service.state.settings.launchAtLogin).toBe(false)

      mocks.rename.mockRejectedValueOnce(Object.assign(Error('write failed'), { code: 'EACCES' }))
      await expect(
        service.execute({
          type: 'settings',
          settings: { ...service.state.settings, launchAtLogin: true },
        }),
      ).rejects.toThrow()
      expect(mocks.loginItem.set).toHaveBeenLastCalledWith({ openAtLogin: false })
      expect(service.state.settings.launchAtLogin).toBe(false)
    } finally {
      await service.dispose()
    }
  })
  it('已有配置时以系统中实际的开机启动状态为准', async () => {
    mocks.loginItem.isPackaged = true
    mocks.loginItem.get.mockReturnValue({
      openAtLogin: true,
      executableWillLaunchAtLogin: true,
    })
    mocks.read.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        settings: { ...defaultSettings, launchAtLogin: false },
        profiles: [],
      }),
    )
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      expect(service.state.settings.launchAtLogin).toBe(true)
      expect(mocks.loginItem.set).not.toHaveBeenCalled()
    } finally {
      await service.dispose()
    }
  })
  it('非安装版忽略开机自启动且不调用系统接口', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      expect(service.state.launchAtLoginAvailable).toBe(false)
      await service.execute({
        type: 'settings',
        settings: { ...service.state.settings, theme: 'dark' },
      })
      expect(mocks.loginItem.set).not.toHaveBeenCalled()
      expect(service.state.settings.theme).toBe('dark')
      expect(service.state.settings.launchAtLogin).toBe(false)
    } finally {
      await service.dispose()
    }
  })
  it('保存主题偏好并兼容旧配置，拒绝无效主题', async () => {
    mocks.read.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        settings: { ...defaultSettings, theme: 'light' },
        profiles: [],
      }),
    )
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      expect(service.state.settings.theme).toBe('light')
      await service.execute({
        type: 'settings',
        settings: { ...service.state.settings, theme: 'dark' },
      })
      expect(service.state.settings.theme).toBe('dark')
      expect(mocks.write).toHaveBeenCalledWith(
        'test-data\\control.json.tmp',
        expect.stringContaining('"theme": "dark"'),
      )
      await expect(
        service.execute({
          type: 'settings',
          settings: { ...service.state.settings, theme: 'invalid' as never },
        }),
      ).rejects.toThrow('无效的主题设置')
      expect(service.state.settings.theme).toBe('dark')
    } finally {
      await service.dispose()
    }

    mocks.read.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        settings: { ...defaultSettings, theme: undefined },
        profiles: [],
      }),
    )
    const old = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await old.init()
      expect(old.state.settings.theme).toBe('system')
    } finally {
      await old.dispose()
    }
  })
  it('切换应用主题时不重新注册全局快捷键', async () => {
    mocks.register.mockReturnValue(false)
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      mocks.register.mockClear()

      await service.execute({
        type: 'settings',
        settings: { ...service.state.settings, theme: 'light' },
      })
      expect(service.state.settings.theme).toBe('light')
      expect(mocks.register).not.toHaveBeenCalled()

      await service.execute({
        type: 'settings',
        settings: { ...service.state.settings, theme: 'dark' },
      })
      expect(service.state.settings.theme).toBe('dark')
      expect(mocks.register).not.toHaveBeenCalled()
    } finally {
      await service.dispose()
    }
  })
  it('切换全屏滤镜，并在原生失败时保留最后成功状态', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    try {
      await service.init()
      mocks.request.mockClear()
      mocks.request.mockResolvedValueOnce({ available: true, active: 'reading', reason: null })
      await service.execute({ type: 'screen-filter', filter: 'reading' })
      expect(mocks.request).toHaveBeenCalledWith('screen-filter-apply', 'reading')
      expect(service.state.screenFilter.active).toBe('reading')

      mocks.request.mockResolvedValueOnce({ available: true, active: 'fps-dark', reason: null })
      await service.execute({ type: 'screen-filter', filter: 'fps-dark' })
      expect(mocks.request).toHaveBeenCalledWith('screen-filter-apply', 'fps-dark')
      expect(service.state.screenFilter.active).toBe('fps-dark')

      mocks.request.mockRejectedValueOnce(Error('应用屏幕滤镜失败'))
      await expect(service.execute({ type: 'screen-filter', filter: 'night' })).rejects.toThrow(
        '应用屏幕滤镜失败',
      )
      expect(service.state.screenFilter.active).toBe('fps-dark')
      await expect(
        service.execute({ type: 'screen-filter', filter: 'invalid' as never }),
      ).rejects.toThrow('未知的屏幕滤镜')
    } finally {
      await service.dispose()
    }
  })
  it('保存并应用自定义滤镜，保护使用中的方案', async () => {
    const service = createControlService('test-data', vi.fn(), vi.fn())
    const settings = {
      ...defaultCustomFilterSettings,
      red: 120,
      green: 95,
      blue: 80,
      saturation: 85,
      brightness: 10,
      temperature: 5700,
    }
    try {
      await service.init()
      await expect(
        service.execute({
          type: 'save-custom-filter',
          name: '无效',
          settings: { ...settings, red: 0 },
        }),
      ).rejects.toThrow('超出允许范围')
      expect(service.state.customFilters).toEqual([])
      await service.execute({ type: 'save-custom-filter', name: '暖色工作', settings })
      const saved = service.state.customFilters[0]!
      expect(saved.name).toBe('暖色工作')
      const write = mocks.write.mock.calls.findLast(([path]) =>
        String(path).endsWith('control.json.tmp'),
      )
      expect(JSON.parse(String(write?.[1])).customFilters).toEqual([saved])

      mocks.request.mockResolvedValueOnce({
        available: true,
        active: 'custom',
        customId: saved.id,
        reason: null,
      })
      await service.execute({ type: 'apply-custom-filter', id: saved.id })
      expect(mocks.request).toHaveBeenCalledWith('screen-filter-apply-custom', {
        id: saved.id,
        matrix: createCustomFilterMatrix(settings),
      })
      await expect(service.execute({ type: 'delete-custom-filter', id: saved.id })).rejects.toThrow(
        '先关闭当前滤镜',
      )
      mocks.request.mockResolvedValueOnce({ available: true, active: 'off', reason: null })
      await service.execute({ type: 'screen-filter', filter: 'off' })
      await service.execute({ type: 'delete-custom-filter', id: saved.id })
      expect(service.state.customFilters).toEqual([])

      mocks.read.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          settings: defaultSettings,
          profiles: [],
          customFilters: [saved],
        }),
      )
      const reloaded = createControlService('test-data', vi.fn(), vi.fn())
      try {
        await reloaded.init()
        expect(reloaded.state.customFilters).toEqual([saved])
      } finally {
        await reloaded.dispose()
      }
    } finally {
      await service.dispose()
    }
  })
})
