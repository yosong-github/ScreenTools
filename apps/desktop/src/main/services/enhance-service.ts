import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import type { Socket } from 'node:net'
import { basename, join, resolve } from 'node:path'
import { app, dialog, globalShortcut } from 'electron'
import type { BrowserWindow, OpenDialogOptions } from 'electron'
import koffi from 'koffi'
import type {
  EnhanceCrop,
  EnhancePreset,
  EnhanceState,
  EnhanceWindow,
  EnhanceWindowSnapshot,
} from '@screentools/contracts'
import { setPanelModalOpen } from '../window'
import { buildRifeScript, isEnhancePreset } from './enhance-scripts'

const COMPONENT_MARKER = 'screentools-component.json'
const RIFE_MODEL = join('vs-plugins', 'models', 'rife_v2', 'rife_v4.25_lite.onnx')
const FSRCNNX_SHADER = join('portable_config', 'shaders', 'FSRCNNX', 'FSRCNNX_x2_16_0_4_1.glsl')
const MODERN_ANIME_SHADER = join('portable_config', 'shaders', 'Ani', 'k7_modernAnime_FHD_x2.glsl')
const WINDOW_TOGGLE_SHORTCUT = 'Control+Alt+G'
const WINDOW_STOP_SHORTCUT = 'Control+Alt+Shift+E'
const WINDOW_TOGGLE_MESSAGE = 0x8000 + 1
const user32 = koffi.load('user32.dll')
const postMessage = user32.func(
  'bool __stdcall PostMessageW(uintptr_t, uint32_t, uintptr_t, intptr_t)',
)
const POLL_INTERVAL_MS = 1000
const VIDEO_EXTENSIONS = [
  'mp4',
  'mkv',
  'webm',
  'mov',
  'avi',
  'm4v',
  'wmv',
  'flv',
  'ts',
  'm2ts',
  'mpg',
  'mpeg',
]

type StatusField =
  'title' | 'sourceFps' | 'outputFps' | 'droppedFrames' | 'position' | 'duration' | 'paused'

interface SavedSettings {
  preset: EnhancePreset
  componentDir: string | null
}

function defaultState(): EnhanceState {
  return {
    component: {
      available: false,
      tensorrt: false,
      directory: null,
      version: null,
      error: '未选择增强组件目录',
    },
    settings: { preset: 'auto' },
    playback: null,
    windowCapture: {
      active: false,
      visible: true,
      hwnd: null,
      title: '',
      process: '',
      error: null,
    },
    error: null,
  }
}

function parseWindowLine(line: string): EnhanceWindow | null {
  try {
    const value = JSON.parse(line) as Partial<EnhanceWindow>
    if (
      typeof value.hwnd !== 'number' ||
      typeof value.title !== 'string' ||
      typeof value.process !== 'string' ||
      !Array.isArray(value.rect) ||
      value.rect.length !== 4 ||
      !value.rect.every((item) => typeof item === 'number') ||
      !Array.isArray(value.monitor) ||
      value.monitor.length !== 4 ||
      !value.monitor.every((item) => typeof item === 'number')
    )
      return null
    return value as EnhanceWindow
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 画质增强：管理增强组件与独立 mpv 播放进程，主进程不执行模型推理。 */
export class EnhanceService {
  readonly state = defaultState()
  private componentDir: string | null = null
  private child: ChildProcess | null = null
  private windowChild: ChildProcess | null = null
  private overlayHwnd: number | null = null
  private socket: Socket | null = null
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private stdinBuffer = ''
  private requestId = 0
  private pending = new Map<number, StatusField>()
  private batchRemaining = 0
  private disposed = false
  private stopping = false
  private io: Promise<unknown> = Promise.resolve()
  private readonly settingsPath: string

  constructor(
    private readonly dataDir: string,
    private readonly changed: (state: EnhanceState) => void,
    private readonly getWindow: () => BrowserWindow | null,
  ) {
    this.settingsPath = join(dataDir, 'enhance.json')
  }

  async init(): Promise<void> {
    await this.loadSettings()
    await this.refreshComponent()
    this.notify()
  }

  async listWindows(): Promise<EnhanceWindow[]> {
    const worker = this.workerPath()
    if (!existsSync(worker)) {
      this.state.error = `窗口增强组件不存在：${worker}`
      this.notify()
      return []
    }
    return new Promise((resolve) => {
      const child = spawn(worker, ['--list'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      let error = ''
      child.stdout?.setEncoding('utf8')
      child.stderr?.setEncoding('utf8')
      child.stdout?.on('data', (chunk: string) => {
        output += chunk
      })
      child.stderr?.on('data', (chunk: string) => {
        error += chunk
      })
      child.once('error', () => {
        this.state.error = '无法启动窗口增强组件'
        this.notify()
        resolve([])
      })
      child.once('close', (code) => {
        if (code !== 0) {
          this.state.error = error.trim() || '读取窗口列表失败'
          this.notify()
          resolve([])
          return
        }
        const seen = new Set<number>()
        const windows: EnhanceWindow[] = []
        for (const line of output.split(/\r?\n/)) {
          const window = parseWindowLine(line)
          if (!window || seen.has(window.hwnd)) continue
          if (!window.title.trim()) continue
          const [left, top, right, bottom] = window.rect
          if (right <= left || bottom <= top || left <= -10000 || top <= -10000) continue
          const process = window.process.toLowerCase()
          if (process.includes('screentools') || process.includes('electron')) continue
          if (window.title.includes('ScreenTools Enhance')) continue
          seen.add(window.hwnd)
          windows.push(window)
        }
        windows.sort((a, b) => a.process.localeCompare(b.process) || a.title.localeCompare(b.title))
        this.state.error = null
        this.notify()
        resolve(windows.slice(0, 100))
      })
    })
  }

  async captureWindowSnapshot(hwnd: number): Promise<EnhanceWindowSnapshot | null> {
    const worker = this.workerPath()
    if (!existsSync(worker) || !Number.isInteger(hwnd) || hwnd <= 0) return null
    const file = join(this.dataDir, `window-snapshot-${randomUUID()}.png`)
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(worker, ['--snapshot', String(hwnd), file], {
          windowsHide: true,
          stdio: 'ignore',
        })
        child.once('error', reject)
        child.once('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`snapshot exited ${code}`)),
        )
      })
      const data = await readFile(file)
      if (data.length < 24 || data.length > 40 * 1024 * 1024) return null
      const width = data.readUInt32BE(16)
      const height = data.readUInt32BE(20)
      if (width < 64 || height < 64 || width > 10000 || height > 10000) return null
      return {
        dataUrl: `data:image/png;base64,${data.toString('base64')}`,
        width,
        height,
      }
    } catch {
      return null
    } finally {
      void unlink(file).catch(() => {})
    }
  }

  async startWindowEnhance(target: EnhanceWindow, crop?: EnhanceCrop): Promise<EnhanceState> {
    const worker = this.workerPath()
    if (!existsSync(worker)) {
      this.state.error = `窗口增强组件不存在：${worker}`
      this.notify()
      return this.state
    }
    if (!Number.isInteger(target.hwnd) || target.hwnd <= 0) {
      this.state.error = '无效的窗口句柄'
      this.notify()
      return this.state
    }
    this.stopPlaybackInternal()
    this.stopWindowInternal()
    const args = ['--capture', String(target.hwnd), String(60 * 60)]
    if (
      crop &&
      [crop.x, crop.y, crop.width, crop.height].every(Number.isInteger) &&
      crop.width >= 16 &&
      crop.height >= 16
    ) {
      args.push('--crop', String(crop.x), String(crop.y), String(crop.width), String(crop.height))
    }
    const child = spawn(worker, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let statusBuffer = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-2000)
      void appendFile(join(this.dataDir, 'window-worker.log'), chunk).catch(() => {})
      statusBuffer += chunk
      const lines = statusBuffer.split(/\r?\n/)
      statusBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const overlayMatch = /^overlay hwnd=(\d+)$/.exec(line.trim())
        if (overlayMatch) {
          this.overlayHwnd = Number(overlayMatch[1])
          continue
        }
        const visibleMatch = /^state visible=([01])$/.exec(line.trim())
        if (!visibleMatch) continue
        this.state.windowCapture.visible = visibleMatch[1] === '1'
        this.notify()
      }
    })
    this.overlayHwnd = null
    this.windowChild = child
    this.state.windowCapture = {
      active: true,
      visible: true,
      hwnd: target.hwnd,
      title: target.title,
      process: target.process,
      error: null,
    }
    this.state.error = null
    this.registerWindowShortcuts()
    child.once('error', () => {
      if (this.windowChild !== child) return
      this.windowChild = null
      this.overlayHwnd = null
      this.unregisterWindowShortcuts()
      this.state.windowCapture = {
        active: false,
        visible: true,
        hwnd: null,
        title: '',
        process: '',
        error: '窗口增强启动失败',
      }
      this.notify()
    })
    child.once('exit', (code) => {
      if (this.windowChild !== child) return
      this.windowChild = null
      this.overlayHwnd = null
      this.unregisterWindowShortcuts()
      const lastLine = stderr
        .trim()
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('state visible='))
        .slice(-1)[0]
      this.state.windowCapture = {
        active: false,
        visible: true,
        hwnd: null,
        title: '',
        process: '',
        error: code ? lastLine || `窗口增强已退出（${code}）` : null,
      }
      this.notify()
    })
    this.notify()
    return this.state
  }

  async stopWindowEnhance(): Promise<EnhanceState> {
    this.stopWindowInternal()
    this.state.error = null
    this.notify()
    return this.state
  }

  toggleWindowEnhance(): EnhanceState {
    if (!this.windowChild || !this.overlayHwnd) return this.state
    if (!postMessage(this.overlayHwnd, WINDOW_TOGGLE_MESSAGE, 0, 0)) {
      this.state.error = '无法切换窗口增强'
      this.notify()
      return this.state
    }
    this.state.windowCapture.visible = !this.state.windowCapture.visible
    this.notify()
    return this.state
  }

  private registerWindowShortcuts(): void {
    this.unregisterWindowShortcuts()
    const toggleRegistered = globalShortcut.register(WINDOW_TOGGLE_SHORTCUT, () => {
      this.toggleWindowEnhance()
    })
    const stopRegistered = globalShortcut.register(WINDOW_STOP_SHORTCUT, () => {
      void this.stopWindowEnhance()
    })
    if (!toggleRegistered) this.state.error = `快捷键 ${WINDOW_TOGGLE_SHORTCUT} 被占用`
    if (!stopRegistered)
      this.state.error = this.state.error ?? `快捷键 ${WINDOW_STOP_SHORTCUT} 被占用`
  }

  private unregisterWindowShortcuts(): void {
    globalShortcut.unregister(WINDOW_TOGGLE_SHORTCUT)
    globalShortcut.unregister(WINDOW_STOP_SHORTCUT)
  }

  private workerPath(): string {
    const override = process.env.SCREENTOOLS_ENHANCE_WORKER?.trim()
    if (override) return override
    if (app.isPackaged) return join(process.resourcesPath, 'enhance-worker.exe')
    return join(
      app.getAppPath(),
      '..',
      '..',
      'native',
      'enhance-worker',
      'build',
      'Release',
      'enhance-worker.exe',
    )
  }

  private stopWindowInternal(): void {
    const child = this.windowChild
    this.windowChild = null
    this.overlayHwnd = null
    this.unregisterWindowShortcuts()
    if (child && !child.killed) child.kill()
    this.state.windowCapture = {
      active: false,
      visible: true,
      hwnd: null,
      title: '',
      process: '',
      error: null,
    }
  }

  async chooseComponent(): Promise<EnhanceState> {
    const window = this.window()
    if (window) setPanelModalOpen(window, true)
    try {
      const options: OpenDialogOptions = {
        title: '选择画质增强组件目录',
        buttonLabel: '使用此目录',
        properties: ['openDirectory'],
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths[0]) return this.state
      const directory = result.filePaths[0]
      const next = await this.validateComponent(directory)
      if (!next.available) {
        this.state.component = next
        this.state.error = next.error
        this.notify()
        return this.state
      }
      this.componentDir = directory
      this.state.component = next
      this.state.error = null
      try {
        await this.persist()
      } catch {
        this.state.error = '无法保存增强设置'
      }
      this.notify()
      return this.state
    } finally {
      if (window) setPanelModalOpen(window, false)
    }
  }

  async openVideo(file?: string): Promise<EnhanceState> {
    if (!this.state.component.available) {
      this.state.error = this.state.component.error ?? '增强组件不可用'
      this.notify()
      return this.state
    }
    if (file) {
      const target = resolve(file)
      try {
        if (!(await stat(target)).isFile()) throw new Error()
      } catch {
        this.state.error = '无法读取视频文件'
        this.notify()
        return this.state
      }
      return this.startPlayback(target)
    }
    const window = this.window()
    if (window) setPanelModalOpen(window, true)
    try {
      const options: OpenDialogOptions = {
        title: '打开视频（画质增强）',
        buttonLabel: '开始播放',
        properties: ['openFile'],
        filters: [
          { name: '视频文件', extensions: VIDEO_EXTENSIONS },
          { name: '所有文件', extensions: ['*'] },
        ],
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths[0]) return this.state
      return this.startPlayback(result.filePaths[0])
    } finally {
      if (window) setPanelModalOpen(window, false)
    }
  }

  async stopPlayback(): Promise<EnhanceState> {
    this.stopPlaybackInternal()
    this.notify()
    return this.state
  }

  async setPreset(preset: EnhancePreset): Promise<EnhanceState> {
    if (!isEnhancePreset(preset)) return this.state
    if (this.state.settings.preset === preset) return this.state
    const file = this.state.playback?.file
    this.stopPlaybackInternal()
    this.state.settings.preset = preset
    try {
      await this.persist()
    } catch {
      this.state.error = '无法保存增强设置'
    }
    if (file && this.state.component.available) return this.startPlayback(file)
    this.notify()
    return this.state
  }

  dispose(): void {
    this.disposed = true
    this.stopPlaybackInternal()
    this.stopWindowInternal()
  }

  private window(): BrowserWindow | null {
    const window = this.getWindow()
    return window && !window.isDestroyed() ? window : null
  }

  private async loadSettings(): Promise<void> {
    let saved: Partial<SavedSettings> = {}
    try {
      const raw = await readFile(this.settingsPath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') saved = parsed as Partial<SavedSettings>
    } catch {
      // 首次运行或设置损坏时使用默认值。
    }
    if (isEnhancePreset(saved.preset)) this.state.settings.preset = saved.preset
    const envDir = process.env.SCREENTOOLS_ENHANCE_DIR?.trim()
    if (typeof saved.componentDir === 'string' && saved.componentDir.trim())
      this.componentDir = saved.componentDir
    if (envDir) this.componentDir = envDir
    this.componentDir ??= join(this.dataDir, 'enhance')
  }

  private async persist(): Promise<void> {
    const payload: SavedSettings = {
      preset: this.state.settings.preset,
      componentDir: this.componentDir,
    }
    this.io = this.io
      .catch(() => {})
      .then(async () => {
        await mkdir(this.dataDir, { recursive: true })
        const temporary = `${this.settingsPath}.tmp`
        await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
        await rename(temporary, this.settingsPath)
      })
  }

  private async refreshComponent(): Promise<void> {
    if (!this.componentDir) {
      this.state.component = {
        available: false,
        tensorrt: false,
        directory: null,
        version: null,
        error: '未选择增强组件目录',
      }
      return
    }
    this.state.component = await this.validateComponent(this.componentDir)
  }

  private async validateComponent(directory: string): Promise<EnhanceState['component']> {
    if (!existsSync(directory))
      return {
        available: false,
        tensorrt: false,
        directory,
        version: null,
        error: '增强组件目录不存在',
      }
    const required = [
      'mpv.exe',
      'VSScript.dll',
      join('Lib', 'site-packages', 'vapoursynth.dll'),
      join('Lib', 'site-packages', 'k7sfunc', '__init__.py'),
      join('vs-plugins', 'vsort.dll'),
      join('vs-plugins', 'vsort', 'onnxruntime.dll'),
      join('vs-plugins', 'vsort', 'DirectML.dll'),
      RIFE_MODEL,
    ]
    const missing = required.find((file) => !existsSync(join(directory, file)))
    if (missing)
      return {
        available: false,
        tensorrt: false,
        directory,
        version: null,
        error: `增强组件缺少 ${missing}`,
      }
    const tensorrtFiles = [
      join('vs-plugins', 'vstrt.dll'),
      join('vs-plugins', 'vsmlrt-cuda', 'trtexec.exe'),
      join('vs-plugins', 'vsmlrt-cuda', 'nvinfer_10.dll'),
    ]
    const tensorrt = tensorrtFiles.every((file) => existsSync(join(directory, file)))
    let version: string | null = null
    try {
      const raw = await readFile(join(directory, COMPONENT_MARKER), 'utf8')
      const marker = JSON.parse(raw.startsWith('\uFEFF') ? raw.slice(1) : raw) as {
        version?: unknown
      }
      if (typeof marker.version === 'string') version = marker.version
    } catch {
      version = null
    }
    return { available: true, tensorrt, directory, version, error: null }
  }

  private shaderPath(): string | null {
    if (!this.componentDir) return null
    const preset = this.state.settings.preset
    if (preset === 'anime' || preset === 'tensorrt')
      return existsSync(join(this.componentDir, MODERN_ANIME_SHADER)) ? MODERN_ANIME_SHADER : null
    // 900p 再走 FSRCNNX 会明显增加 GPU 压力；质量档使用 mpv 的 ewa_lanczos。
    if (preset !== 'balanced' && preset !== 'performance') return null
    return existsSync(join(this.componentDir, FSRCNNX_SHADER)) ? FSRCNNX_SHADER : null
  }

  private async startPlayback(file: string): Promise<EnhanceState> {
    this.stopPlaybackInternal()
    this.stopWindowInternal()
    const directory = this.componentDir
    if (!directory || !this.state.component.available) {
      this.state.error = '增强组件不可用'
      this.notify()
      return this.state
    }
    const script = buildRifeScript(this.state.settings.preset)
    if (script) {
      try {
        await mkdir(join(directory, 'screentools'), { recursive: true })
        await writeFile(join(directory, 'screentools', 'rife.vpy'), script, 'utf8')
      } catch {
        this.state.error = '无法写入增强脚本，请确认组件目录可写'
        this.notify()
        return this.state
      }
    }
    const pipePath = `\\\\.\\pipe\\screentools-mpv-${randomUUID()}`
    const args = [
      '--no-config',
      '--vo=gpu-next',
      '--hwdec=auto-safe',
      '--keep-open=no',
      '--force-window=yes',
      '--title=ScreenTools · 画质增强',
      '--scale=ewa_lanczos',
      `--input-ipc-server=${pipePath}`,
    ]
    if (script) args.push('--vf=vapoursynth=screentools/rife.vpy')
    const shader = this.shaderPath()
    if (shader) args.push(`--glsl-shaders=${shader}`)
    args.push(file)

    const env = { ...process.env }
    if (this.state.settings.preset === 'tensorrt') {
      const tensorrtDir = join(directory, 'vs-plugins', 'vsmlrt-cuda')
      env.PATH = `${tensorrtDir};${env.PATH ?? ''}`
    }

    let child: ChildProcess
    try {
      child = spawn(join(directory, 'mpv.exe'), args, {
        cwd: directory,
        env,
        stdio: 'ignore',
        windowsHide: false,
      })
    } catch {
      this.state.error = '无法启动播放器'
      this.notify()
      return this.state
    }
    this.child = child
    this.state.playback = {
      file,
      title: basename(file),
      sourceFps: null,
      outputFps: null,
      droppedFrames: 0,
      position: null,
      duration: null,
      paused: false,
    }
    this.state.error = null
    child.once('error', () => {
      if (this.child !== child) return
      this.state.error = '播放器启动失败'
      this.state.playback = null
      this.child = null
      this.stopStatusSocket()
      this.notify()
    })
    child.once('exit', () => {
      if (this.child !== child) return
      this.child = null
      this.state.playback = null
      this.state.error = null
      this.stopStatusSocket()
      this.notify()
    })
    this.notify()
    void this.connectStatus(pipePath)
    return this.state
  }

  private async connectStatus(pipePath: string): Promise<void> {
    const child = this.child
    for (let attempt = 0; attempt < 50; attempt++) {
      if (!child || this.child !== child) return
      const socket = await new Promise<Socket | null>((resolve) => {
        const candidate = connect(pipePath)
        candidate.once('connect', () => resolve(candidate))
        candidate.once('error', () => {
          candidate.destroy()
          resolve(null)
        })
      })
      if (socket) {
        this.socket = socket
        socket.setEncoding('utf8')
        socket.on('data', (chunk) => {
          if (this.socket === socket) this.onStatusData(chunk.toString())
        })
        socket.on('error', () => {
          if (this.socket === socket) this.onStatusClosed()
        })
        socket.on('close', () => {
          if (this.socket === socket) this.onStatusClosed()
        })
        this.pollTimer = setInterval(() => this.pollStatus(), POLL_INTERVAL_MS)
        this.pollStatus()
        return
      }
      await sleep(100)
    }
    if (this.child === child) {
      this.state.error = '播放器状态接口未连接，仍可继续播放'
      this.notify()
    }
  }

  private pollStatus(): void {
    const socket = this.socket
    if (!socket || socket.destroyed) return
    const properties: Array<[StatusField, string]> = [
      ['title', 'media-title'],
      ['sourceFps', 'container-fps'],
      ['outputFps', 'estimated-vf-fps'],
      ['droppedFrames', 'frame-drop-count'],
      ['position', 'time-pos'],
      ['duration', 'duration'],
      ['paused', 'pause'],
    ]
    this.pending.clear()
    this.batchRemaining = properties.length
    for (const [field, property] of properties) {
      const id = ++this.requestId
      this.pending.set(id, field)
      socket.write(`${JSON.stringify({ command: ['get_property', property], request_id: id })}\n`)
    }
  }

  private onStatusData(chunk: string): void {
    this.stdinBuffer += chunk
    let newline = this.stdinBuffer.indexOf('\n')
    while (newline >= 0) {
      const line = this.stdinBuffer.slice(0, newline).trim()
      this.stdinBuffer = this.stdinBuffer.slice(newline + 1)
      if (line) this.onStatusMessage(line)
      newline = this.stdinBuffer.indexOf('\n')
    }
  }

  private onStatusMessage(line: string): void {
    let message: {
      request_id?: number
      error?: string
      data?: unknown
    }
    try {
      message = JSON.parse(line) as typeof message
    } catch {
      return
    }
    if (typeof message.request_id !== 'number') return
    const field = this.pending.get(message.request_id)
    if (!field) return
    this.pending.delete(message.request_id)
    if (message.error === 'success') this.applyStatus(field, message.data)
    this.batchRemaining -= 1
    if (this.batchRemaining <= 0) this.notify()
  }

  private applyStatus(field: StatusField, value: unknown): void {
    const playback = this.state.playback
    if (!playback) return
    if (field === 'title') {
      if (typeof value === 'string' && value) playback.title = value
      return
    }
    if (field === 'paused') {
      if (typeof value === 'boolean') playback.paused = value
      return
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (field === 'sourceFps') playback.sourceFps = value > 0 ? value : null
    else if (field === 'outputFps') playback.outputFps = value > 0 ? value : null
    else if (field === 'droppedFrames') playback.droppedFrames = Math.max(0, Math.round(value))
    else if (field === 'position') playback.position = Math.max(0, value)
    else if (field === 'duration') playback.duration = value > 0 ? value : null
  }

  private onStatusClosed(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = undefined
    this.socket = null
    this.pending.clear()
    if (this.child) {
      this.state.error = '播放器状态连接已断开'
      this.notify()
    }
  }

  private stopStatusSocket(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = undefined
    this.pending.clear()
    this.stdinBuffer = ''
    const socket = this.socket
    this.socket = null
    if (socket && !socket.destroyed) socket.destroy()
  }

  private stopPlaybackInternal(): void {
    if (this.stopping) return
    this.stopping = true
    try {
      const socket = this.socket
      if (socket && !socket.destroyed) {
        try {
          socket.write(`${JSON.stringify({ command: ['quit'] })}\n`)
        } catch {
          // 播放器可能已退出。
        }
      }
      this.stopStatusSocket()
      const child = this.child
      this.child = null
      if (child && !child.killed) child.kill()
      this.state.playback = null
      this.state.error = null
    } finally {
      this.stopping = false
    }
  }

  private notify(): void {
    if (this.disposed) return
    this.changed(this.state)
  }
}
