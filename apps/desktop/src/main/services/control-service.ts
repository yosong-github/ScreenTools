import { app, clipboard, dialog, globalShortcut } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultSettings } from '@screentools/contracts'
import type {
  AppSettings,
  ChangePlan,
  ControlCommand,
  ControlState,
  DisplayProfile,
  HardwareCapabilities,
  HardwareSetting,
  NativeDisplay,
  PendingChange,
} from '@screentools/contracts'
import { NativeClient } from './native-client'

export function createControlService(dataDir: string, changed: () => void, showWindow: () => void) {
  const state: ControlState = {
    devices: [],
    profiles: [],
    settings: { ...defaultSettings, aliases: {} },
    capabilities: {},
    pending: null,
    error: null,
    logs: [],
  }
  let pendingHardware: HardwareSetting[] = []
  let queue: Promise<unknown> = Promise.resolve()
  let io: Promise<unknown> = Promise.resolve()
  let validStorage = true
  let stopping = false
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
  const native = new NativeClient((error) => {
    if (!error) {
      state.pending = null
      pendingHardware = []
    }
    state.error = error ?? null
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
      { version: 1, settings: state.settings, profiles: state.profiles },
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
  async function hardware(id: string, setting?: HardwareSetting): Promise<void> {
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
          const result = await worker.request<HardwareCapabilities>(
            setting ? 'hardware' : 'probe',
            setting ?? id,
            12000,
          )
          if (stopping || hardwareWorkers.get(id) !== entry)
            throw new Error('设备通信已取消，请重新探测')
          if (state.devices.some((d) => d.id === id)) {
            // 快速写入仅回传当前参数，保留其他已经探测到的能力。
            state.capabilities[id] =
              setting?.feature === 'brightness' || setting?.feature === 'contrast'
                ? { ...state.capabilities[id], ...result }
                : result
          }
          state.error = null
          record(setting ? '硬件参数已提交；最新能力以重新读取为准' : '硬件能力探测完成')
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
  function probeNewDevices(): void {
    if (state.pending || stopping) return
    for (const d of state.devices) {
      if (probed.has(d.id)) continue
      probed.add(d.id)
      // 每个设备只自动探测一次；失败后由用户重试，避免持续打扰慢速驱动。
      void hardware(d.id).catch(() => record('自动硬件探测失败，可在设备面板手动重试'))
    }
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
    const devices = await native.request<NativeDisplay[]>('snapshot')
    for (const setting of [...plan.displays, ...plan.hardware])
      if (!devices.some((d) => d.id === setting.id)) throw new Error('方案所需设备未全部连接')
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
    let before = { profiles: state.profiles, settings: state.settings }
    const task = queue
      .catch(() => {})
      .then(async () => {
        before = {
          profiles: structuredClone(state.profiles),
          settings: structuredClone(state.settings),
        }
        if (stopping) throw new Error('应用正在退出')
        if (state.pending && !['confirm', 'revert', 'refresh'].includes(command.type))
          throw new Error('请先确认或恢复显示配置')
        if (
          !validStorage &&
          ['settings', 'save-profile', 'delete-profile', 'import-profiles'].includes(command.type)
        )
          throw new Error('本地配置损坏，请先备份并修复 control.json')
        switch (command.type) {
          case 'refresh':
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
            return structuredClone(state)
          case 'hardware':
            await hardware(command.setting.id, command.setting)
            if (command.setting.feature !== 'inputSource' && command.setting.feature !== 'power')
              return structuredClone(state)
            break
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
          case 'settings':
            if (command.settings.launchAtLogin && !app.isPackaged)
              throw new Error('开机启动仅适用于已安装版本')
            registerShortcut(command.settings)
            app.setLoginItemSettings({ openAtLogin: command.settings.launchAtLogin })
            state.settings = command.settings
            await save()
            record('应用设置已保存')
            break
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
        return refresh()
      })
    queue = task
    try {
      return await task
    } catch (error) {
      if (
        ['settings', 'save-profile', 'delete-profile', 'import-profiles'].includes(command.type)
      ) {
        if (command.type === 'settings') {
          try {
            registerShortcut(before.settings)
            app.setLoginItemSettings({ openAtLogin: before.settings.launchAtLogin })
          } catch {
            /* 回退失败仍保留旧持久化配置。 */
          }
        }
        state.profiles = before.profiles
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
    }
  }
  async function init(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(join(dataDir, 'control.json'), 'utf8')) as {
        version: number
        settings: AppSettings
        profiles: DisplayProfile[]
      }
      if (data.version !== 1) throw new Error('版本不支持')
      state.settings = {
        ...defaultSettings,
        ...data.settings,
        aliases: data.settings.aliases ?? {},
      }
      state.profiles = data.profiles
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        validStorage = false
        record('本地配置无法读取，已保留原文件并使用默认设置')
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
    if (state.settings.startupProfileId)
      await execute({ type: 'apply-profile', id: state.settings.startupProfileId }).catch(() => {})
    probeNewDevices()
  }
  let connected = ''
  async function onDisplaysChanged(): Promise<void> {
    await refresh()
    const signature = state.devices
      .map((d) => d.id)
      .sort()
      .join(',')
    const wasConnected = connected
    connected = signature
    if (
      wasConnected &&
      signature !== wasConnected &&
      state.settings.connectProfileId &&
      !state.pending
    ) {
      await execute({ type: 'apply-profile', id: state.settings.connectProfileId }).catch(() => {})
    }
    probeNewDevices()
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
      for (const id of hardwareWorkers.keys()) releaseWorker(id)
      globalShortcut.unregisterAll()
      await native.dispose()
      await io.catch(() => {})
    },
  }
}
export type ControlService = ReturnType<typeof createControlService>
