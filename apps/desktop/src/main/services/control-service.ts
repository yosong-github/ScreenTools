import { app, clipboard, dialog, globalShortcut } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultSettings } from '@screentools/contracts'
import { createCustomFilterMatrix, defaultCustomFilterSettings } from '@screentools/display-core'
import type {
  AppSettings,
  ChangePlan,
  ControlCommand,
  ControlState,
  CustomScreenFilter,
  DisplayProfile,
  HardwareCapabilities,
  HardwareSetting,
  NativeDisplay,
  PendingChange,
  ScreenFilterId,
  ScreenFilterState,
} from '@screentools/contracts'
import { NativeClient } from './native-client'

const POLL_INTERVAL_MS = 60_000
const screenFilterLabels: Record<ScreenFilterId, string> = {
  off: '原色',
  reading: '阅读',
  night: '夜间',
  grayscale: '灰度',
  'fps-competitive': 'FPS 竞技',
  'fps-vivid': 'FPS 鲜艳',
  'fps-dark': 'FPS 暗场',
  'fps-focus': 'FPS 专注',
}

function isCustomFilter(value: unknown): value is CustomScreenFilter {
  if (!value || typeof value !== 'object') return false
  const filter = value as Partial<CustomScreenFilter>
  if (
    typeof filter.id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(filter.id) ||
    typeof filter.name !== 'string' ||
    !filter.name.trim() ||
    filter.name.length > 40 ||
    !filter.settings ||
    typeof filter.settings !== 'object'
  )
    return false
  try {
    createCustomFilterMatrix({ ...defaultCustomFilterSettings, ...filter.settings })
    return true
  } catch {
    return false
  }
}

export function createControlService(dataDir: string, changed: () => void, showWindow: () => void) {
  const state: ControlState = {
    devices: [],
    profiles: [],
    customFilters: [],
    settings: { ...defaultSettings, aliases: {} },
    launchAtLoginAvailable: app.isPackaged && process.platform === 'win32',
    capabilities: {},
    pending: null,
    screenFilter: { available: false, active: 'off', reason: '正在检测屏幕滤镜能力' },
    error: null,
    logs: [],
  }
  let pendingHardware: HardwareSetting[] = []
  let queue: Promise<unknown> = Promise.resolve()
  let io: Promise<unknown> = Promise.resolve()
  let validStorage = true
  let loadedSettings = false
  let stopping = false
  let queuedCommands = 0
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let pollTask: Promise<void> | null = null
  const hardwareQueues = new Map<string, Promise<unknown>>()
  const readWorkers = new Map<NativeClient, string>()
  const hardwareWorkers = new Map<
    string,
    { worker: NativeClient; idle?: ReturnType<typeof setTimeout> }
  >()
  function releaseWorker(id: string): void {
    const entry = hardwareWorkers.get(id)
    if (!entry) return
    clearTimeout(entry.idle)
    hardwareWorkers.delete(id)
    entry.worker.terminateReadWorker()
  }
  const probed = new Set<string>()
  const probeFailures = new Set<string>()
  const native = new NativeClient((error) => {
    if (!error) {
      state.pending = null
      pendingHardware = []
    }
    state.error = error ?? null
    if (error && !stopping)
      state.screenFilter = { available: false, active: 'off', reason: '原生工作进程已退出' }
    record(error ?? '显示配置已自动恢复')
    void refresh().catch(() => {})
  })
  function record(message: string): void {
    // 不记录设备路径、序列号或用户输入，仅保留操作结果与系统错误。
    state.logs = [...state.logs.slice(-199), { time: new Date().toISOString(), message }]
    changed()
    io = io
      .catch(() => {})
      .then(async () => {
        await mkdir(dataDir, { recursive: true })
        await writeFile(join(dataDir, 'operations.json'), JSON.stringify(state.logs, null, 2))
      })
      .catch(() => {
        state.error = '操作日志无法写入用户目录'
      })
  }
  async function save(): Promise<void> {
    if (!validStorage) throw new Error('本地配置损坏，已保留原文件；请先备份并修复 control.json')
    const contents = JSON.stringify(
      {
        version: 1,
        settings: state.settings,
        profiles: state.profiles,
        customFilters: state.customFilters,
      },
      null,
      2,
    )
    io = io
      .catch(() => {})
      .then(async () => {
        await mkdir(dataDir, { recursive: true })
        await writeFile(join(dataDir, 'control.json.tmp'), contents)
        await rename(join(dataDir, 'control.json.tmp'), join(dataDir, 'control.json'))
      })
    await io
  }
  async function refresh(): Promise<ControlState> {
    try {
      state.devices = await native.request<NativeDisplay[]>('snapshot')
      const ids = new Set(state.devices.map((d) => d.id))
      for (const id of probed) if (!ids.has(id)) probed.delete(id)
      for (const id of probeFailures) if (!ids.has(id)) probeFailures.delete(id)
      for (const id of hardwareWorkers.keys()) if (!ids.has(id)) releaseWorker(id)
      state.capabilities = Object.fromEntries(
        Object.entries(state.capabilities).filter(([id]) => ids.has(id)),
      )
      state.error = null
    } catch (error) {
      state.error = error instanceof Error ? error.message : '原生控制不可用'
    }
    changed()
    return structuredClone(state)
  }
  async function refreshScreenFilter(): Promise<void> {
    try {
      state.screenFilter = await native.request<ScreenFilterState>('screen-filter-status')
    } catch {
      state.screenFilter = {
        available: false,
        active: 'off',
        reason: '当前 Windows 环境无法使用屏幕滤镜',
      }
    }
    changed()
  }
  async function hardware(
    id: string,
    setting?: HardwareSetting,
    readMode: 'probe' | 'poll' = 'probe',
  ): Promise<void> {
    if (state.pending) throw new Error('请先确认显示配置，再操作硬件')
    const work = (hardwareQueues.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        if (stopping) throw new Error('应用正在退出')
        let entry = hardwareWorkers.get(id)
        if (!entry) {
          entry = { worker: new NativeClient() }
          hardwareWorkers.set(id, entry)
        }
        clearTimeout(entry.idle)
        const { worker } = entry
        readWorkers.set(worker, id)
        try {
          const capability = setting ? state.capabilities[id]?.[setting.feature] : undefined
          if (setting && !capability) throw new Error('显示器未确认支持此功能')
          const result = await worker.request<HardwareCapabilities>(
            setting ? 'hardware' : readMode === 'poll' ? 'poll-hardware' : 'probe',
            setting
              ? { setting, capability }
              : readMode === 'poll'
                ? { id, capabilities: state.capabilities[id] ?? {} }
                : id,
            12000,
          )
          if (stopping || hardwareWorkers.get(id) !== entry)
            throw new Error('设备通信已取消，请稍后重试')
          if (state.devices.some((d) => d.id === id)) {
            // 写入与轮询只更新已读取的参数，完整能力清单仅首次探测时替换。
            const previous = state.capabilities[id] ?? {}
            state.capabilities[id] =
              setting || readMode === 'poll' ? { ...previous, ...result } : result
            if (
              readMode === 'poll' &&
              JSON.stringify(previous) !== JSON.stringify(state.capabilities[id])
            )
              changed()
          }
          state.error = null
          if (setting) record('硬件参数已提交；最新值以定时轮询为准')
          else if (readMode === 'probe') record('硬件能力探测完成')
        } catch (error) {
          if (hardwareWorkers.get(id) === entry) releaseWorker(id)
          throw error
        } finally {
          readWorkers.delete(worker)
          if (hardwareWorkers.get(id) === entry) {
            if (stopping || setting?.feature === 'inputSource' || setting?.feature === 'power')
              releaseWorker(id)
            else {
              // 只复用进程，不缓存物理句柄；句柄仍在每次调用结束时释放。
              entry.idle = setTimeout(() => releaseWorker(id), 30000)
              entry.idle.unref()
            }
          }
        }
      })
    hardwareQueues.set(id, work)
    try {
      await work
    } finally {
      if (hardwareQueues.get(id) === work) hardwareQueues.delete(id)
    }
  }
  async function probeNewDevices(): Promise<void> {
    if (state.pending || stopping) return
    await Promise.all(
      state.devices.map(async (d) => {
        if (probed.has(d.id)) return
        probed.add(d.id)
        try {
          await hardware(d.id)
          probeFailures.delete(d.id)
        } catch {
          probed.delete(d.id)
          if (!stopping && !probeFailures.has(d.id)) {
            probeFailures.add(d.id)
            record('自动硬件探测失败，将在下次轮询时重试')
          }
        }
      }),
    )
  }
  function poll(): Promise<void> {
    if (stopping || state.pending || queuedCommands || pollTask) return Promise.resolve()
    const task = (async () => {
      await refresh()
      if (state.error || stopping || state.pending) return
      const previouslyProbed = new Set(probed)
      await probeNewDevices()
      await Promise.all(
        state.devices
          .filter(
            (d) => previouslyProbed.has(d.id) && Object.keys(state.capabilities[d.id] ?? {}).length,
          )
          .map((d) => hardware(d.id, undefined, 'poll').catch(() => {})),
      )
    })()
    pollTask = task
    return task.finally(() => {
      if (pollTask === task) pollTask = null
    })
  }
  function diagnostics(): string {
    return JSON.stringify(
      {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        devices: state.devices.map((d, index) => ({
          ...d,
          id: `display-${index + 1}`,
          name: `显示器 ${index + 1}`,
          modes: d.modes,
          capabilities: state.capabilities[d.id] ?? {},
        })),
        logs: state.logs,
      },
      null,
      2,
    )
  }
  async function applyPlan(plan: ChangePlan): Promise<void> {
    if (plan.hardware.some((s) => s.feature === 'power' || s.feature === 'inputSource'))
      throw new Error('方案禁止自动切换输入源或电源，请通过硬件面板单独确认操作')
    if (state.pending) throw new Error('请先确认或恢复上一次配置')
    if (readWorkers.size) throw new Error('硬件通信中，请稍后重试')
    for (const setting of [...plan.displays, ...plan.hardware])
      if (!state.devices.some((d) => d.id === setting.id)) throw new Error('方案所需设备未全部连接')
    if (plan.displays.length || plan.topology) {
      state.pending = await native.request<PendingChange>('apply', plan, 15000)
      pendingHardware = plan.hardware
      record('显示配置已提交，请在 20 秒内确认，否则自动恢复')
      showWindow()
    } else {
      for (const setting of plan.hardware) await hardware(setting.id, setting)
    }
  }
  function registerShortcut(settings: AppSettings): void {
    const old = state.settings.shortcut
    if (settings.shortcut === old && globalShortcut.isRegistered(old)) return
    if (settings.shortcut && !globalShortcut.register(settings.shortcut, showWindow))
      throw new Error('快捷键已被占用或无效')
    if (old && old !== settings.shortcut) globalShortcut.unregister(old)
  }
  async function execute(command: ControlCommand): Promise<ControlState> {
    queuedCommands++
    let before = {
      profiles: state.profiles,
      customFilters: state.customFilters,
      settings: state.settings,
    }
    const task = queue
      .catch(() => {})
      .then(async () => {
        await pollTask?.catch(() => {})
        before = {
          profiles: structuredClone(state.profiles),
          customFilters: structuredClone(state.customFilters),
          settings: structuredClone(state.settings),
        }
        if (stopping) throw new Error('应用正在退出')
        if (state.pending && !['confirm', 'revert', 'refresh'].includes(command.type))
          throw new Error('请先确认或恢复显示配置')
        if (
          !validStorage &&
          [
            'settings',
            'save-profile',
            'delete-profile',
            'import-profiles',
            'save-custom-filter',
            'delete-custom-filter',
          ].includes(command.type)
        )
          throw new Error('本地配置损坏，请先备份并修复 control.json')
        switch (command.type) {
          case 'refresh':
            await refresh()
            await probeNewDevices()
            break
          case 'apply':
            await applyPlan(command.plan)
            break
          case 'confirm': {
            await native.request('confirm', command.token)
            state.pending = null
            const settings = pendingHardware
            pendingHardware = []
            record('显示配置已确认保存')
            for (const setting of settings) {
              try {
                await hardware(setting.id, setting)
              } catch {
                record('系统配置已保存，但部分硬件参数写入失败')
              }
            }
            break
          }
          case 'revert':
            await native.request('revert', command.token)
            state.pending = null
            pendingHardware = []
            record('显示配置已恢复')
            break
          case 'probe':
            await hardware(command.id)
            probed.add(command.id)
            probeFailures.delete(command.id)
            return structuredClone(state)
          case 'hardware':
            await hardware(command.setting.id, command.setting)
            break
          case 'screen-filter': {
            if (!Object.hasOwn(screenFilterLabels, command.filter))
              throw new Error('未知的屏幕滤镜')
            state.screenFilter = await native.request<ScreenFilterState>(
              'screen-filter-apply',
              command.filter,
            )
            record(`屏幕滤镜已切换为：${screenFilterLabels[command.filter]}`)
            break
          }
          case 'apply-custom-filter': {
            const filter = state.customFilters.find((entry) => entry.id === command.id)
            if (!filter) throw new Error('自定义滤镜方案不存在')
            state.screenFilter = await native.request<ScreenFilterState>(
              'screen-filter-apply-custom',
              { id: filter.id, matrix: createCustomFilterMatrix(filter.settings) },
            )
            record('屏幕滤镜已切换为自定义方案')
            break
          }
          case 'save-custom-filter': {
            const name = command.name.trim()
            if (!name || name.length > 40) throw new Error('滤镜名称须为 1 到 40 个字符')
            if (state.customFilters.length >= 20) throw new Error('自定义滤镜方案数量已达上限')
            createCustomFilterMatrix(command.settings)
            state.customFilters = [
              ...state.customFilters,
              { id: randomUUID(), name, settings: { ...command.settings } },
            ]
            await save()
            record('自定义滤镜方案已保存')
            break
          }
          case 'delete-custom-filter': {
            if (state.screenFilter.customId === command.id)
              throw new Error('请先关闭当前滤镜，再删除方案')
            if (!state.customFilters.some((entry) => entry.id === command.id))
              throw new Error('自定义滤镜方案不存在')
            state.customFilters = state.customFilters.filter((entry) => entry.id !== command.id)
            await save()
            record('自定义滤镜方案已删除')
            break
          }
          case 'save-profile': {
            if (
              state.profiles.length >= 100 &&
              !state.profiles.some((p) => p.id === command.profile.id)
            )
              throw new Error('方案数量已达上限')
            state.profiles = [
              ...state.profiles.filter((p) => p.id !== command.profile.id),
              command.profile,
            ]
            await save()
            record('方案已保存')
            break
          }
          case 'delete-profile':
            state.profiles = state.profiles.filter((p) => p.id !== command.id)
            if (state.settings.startupProfileId === command.id)
              state.settings.startupProfileId = null
            if (state.settings.connectProfileId === command.id)
              state.settings.connectProfileId = null
            await save()
            record('方案已删除')
            break
          case 'apply-profile': {
            const profile = state.profiles.find((p) => p.id === command.id)
            if (!profile) throw new Error('方案不存在')
            await applyPlan(profile.plan)
            break
          }
          case 'settings': {
            if (!['system', 'light', 'dark'].includes(command.settings.theme))
              throw new Error('无效的主题设置')
            // 非安装版不支持开机自启动，统一按关闭保存，避免记录无效状态。
            const launchAtLogin = state.launchAtLoginAvailable && command.settings.launchAtLogin
            if (command.settings.shortcut !== before.settings.shortcut)
              registerShortcut(command.settings)
            if (state.launchAtLoginAvailable && launchAtLogin !== before.settings.launchAtLogin)
              app.setLoginItemSettings({ openAtLogin: launchAtLogin })
            state.settings = { ...command.settings, launchAtLogin }
            await save()
            record('应用设置已保存')
            break
          }
          case 'export-profiles': {
            const file = await dialog.showSaveDialog({
              defaultPath: 'ScreenTools-profiles.json',
              filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (file.filePath)
              await writeFile(
                file.filePath,
                JSON.stringify({ version: 1, profiles: state.profiles }, null, 2),
              )
            break
          }
          case 'import-profiles': {
            const file = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (file.filePaths[0]) {
              const raw = await readFile(file.filePaths[0], 'utf8')
              if (raw.length > 1024 * 1024) throw new Error('方案文件过大')
              const data = JSON.parse(raw) as { version: number; profiles: DisplayProfile[] }
              if (data.version !== 1) throw new Error('不支持的方案文件版本')
              const profiles = data.profiles
              state.profiles = [
                ...new Map([...state.profiles, ...profiles].map((p) => [p.id, p])).values(),
              ]
              await save()
              record('方案导入完成')
            }
            break
          }
          case 'copy-diagnostics':
            clipboard.writeText(diagnostics())
            break
          case 'export-diagnostics': {
            const file = await dialog.showSaveDialog({
              defaultPath: 'ScreenTools-diagnostics.json',
              filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (file.filePath) await writeFile(file.filePath, diagnostics())
            break
          }
        }
        if (command.type === 'confirm' || command.type === 'revert') await refresh()
        return structuredClone(state)
      })
    queue = task
    try {
      return await task
    } catch (error) {
      if (
        [
          'settings',
          'save-profile',
          'delete-profile',
          'import-profiles',
          'save-custom-filter',
          'delete-custom-filter',
        ].includes(command.type)
      ) {
        if (command.type === 'settings') {
          try {
            if (command.settings.shortcut !== before.settings.shortcut)
              registerShortcut(before.settings)
            if (state.launchAtLoginAvailable)
              app.setLoginItemSettings({ openAtLogin: before.settings.launchAtLogin })
          } catch {
            /* 回退失败仍保留旧持久化配置。 */
          }
        }
        state.profiles = before.profiles
        state.customFilters = before.customFilters
        state.settings = before.settings
      }
      // 文件系统异常可能含用户目录，只保留错误码；设备参数校验错误保留可解释文本。
      const code = (error as NodeJS.ErrnoException).code
      const message = code
        ? `操作失败，错误码 ${code}`
        : error instanceof Error
          ? error.message
          : '操作失败'
      state.error = message
      record(message)
      throw error
    } finally {
      queuedCommands--
    }
  }
  async function init(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(join(dataDir, 'control.json'), 'utf8')) as {
        version: number
        settings: AppSettings
        profiles: DisplayProfile[]
        customFilters?: unknown
      }
      if (data.version !== 1) throw new Error('版本不支持')
      state.settings = {
        ...defaultSettings,
        ...data.settings,
        aliases: data.settings.aliases ?? {},
        theme: ['system', 'light', 'dark'].includes(data.settings.theme)
          ? data.settings.theme
          : 'system',
      }
      state.profiles = data.profiles
      state.customFilters = Array.isArray(data.customFilters)
        ? data.customFilters
            .filter(isCustomFilter)
            .slice(0, 20)
            .map((filter) => ({
              ...filter,
              settings: { ...defaultCustomFilterSettings, ...filter.settings },
            }))
        : []
      // 已存在配置：以用户保存的状态为准，不再套用默认值。
      loadedSettings = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        validStorage = false
        record('本地配置无法读取，已保留原文件并使用默认设置')
      }
    }
    if (state.launchAtLoginAvailable) {
      if (loadedSettings) {
        try {
          // Windows 启动应用可在系统设置中单独关闭，以系统中的实际状态为准。
          const loginItem = app.getLoginItemSettings()
          state.settings.launchAtLogin =
            loginItem.openAtLogin && loginItem.executableWillLaunchAtLogin
        } catch {
          record('开机启动状态无法读取')
        }
      } else {
        // 全新安装：按默认设置开启开机自启动，并写入系统。
        try {
          app.setLoginItemSettings({ openAtLogin: state.settings.launchAtLogin })
          record(state.settings.launchAtLogin ? '已默认开启开机自启动' : '默认未开启开机自启动')
        } catch {
          record('开机自启动无法设置')
        }
      }
    }
    try {
      registerShortcut(state.settings)
    } catch {
      record('全局快捷键注册失败')
    }
    await refresh()
    connected = state.devices
      .map((d) => d.id)
      .sort()
      .join(',')
    await probeNewDevices()
    await refreshScreenFilter()
    if (state.settings.startupProfileId)
      await execute({ type: 'apply-profile', id: state.settings.startupProfileId }).catch(() => {})
    pollTimer = setInterval(() => {
      void poll().catch(() => {})
    }, POLL_INTERVAL_MS)
    pollTimer.unref()
  }
  let connected = ''
  async function onDisplaysChanged(): Promise<void> {
    await pollTask?.catch(() => {})
    await refresh()
    const signature = state.devices
      .map((d) => d.id)
      .sort()
      .join(',')
    const wasConnected = connected
    connected = signature
    await probeNewDevices()
    if (
      wasConnected &&
      signature !== wasConnected &&
      state.settings.connectProfileId &&
      !state.pending
    ) {
      await execute({ type: 'apply-profile', id: state.settings.connectProfileId }).catch(() => {})
    }
  }
  return {
    init,
    refresh,
    execute,
    onDisplaysChanged,
    get state() {
      return structuredClone(state)
    },
    async dispose() {
      stopping = true
      clearInterval(pollTimer)
      for (const id of hardwareWorkers.keys()) releaseWorker(id)
      await pollTask?.catch(() => {})
      globalShortcut.unregisterAll()
      await native.dispose()
      await io.catch(() => {})
    },
  }
}
export type ControlService = ReturnType<typeof createControlService>
