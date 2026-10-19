import { createHash } from 'node:crypto'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, net, shell } from 'electron'
import type { UpdateState } from '@screentools/contracts'

const REPOSITORY = 'yosong-github/ScreenTools'
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases/latest`
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const INSTALLER_NAME = /^ScreenTools-(\d+\.\d+\.\d+)-win-x64\.exe$/

interface ReleaseAsset {
  name?: unknown
  size?: unknown
  digest?: unknown
  browser_download_url?: unknown
}
interface GithubRelease {
  tag_name?: unknown
  html_url?: unknown
  assets?: unknown
}
interface Installer {
  url: string
  name: string
  size: number
  sha256: string | null
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] | null => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)
    return match ? match.slice(1).map(Number) : null
  }
  const a = parse(left)
  const b = parse(right)
  if (!a || !b) return 0
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]! ? 1 : -1
  }
  return 0
}

export function parseRelease(
  data: GithubRelease,
  currentVersion: string,
): {
  version: string
  releaseUrl: string
  installer: Installer | null
} | null {
  if (typeof data.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(data.tag_name))
    throw new Error('GitHub Release 版本号无效')
  const version = data.tag_name.replace(/^v/, '')
  if (compareVersions(version, currentVersion) <= 0) return null
  const releaseUrl =
    typeof data.html_url === 'string' &&
    data.html_url === `https://github.com/${REPOSITORY}/releases/tag/${data.tag_name}`
      ? data.html_url
      : RELEASES_URL
  const asset = Array.isArray(data.assets)
    ? (data.assets as ReleaseAsset[]).find(
        (item) => item.name === `ScreenTools-${version}-win-x64.exe`,
      )
    : undefined
  const digest =
    typeof asset?.digest === 'string' ? /^sha256:([a-f\d]{64})$/i.exec(asset.digest) : null
  const expectedUrl = `https://github.com/${REPOSITORY}/releases/download/${data.tag_name}/ScreenTools-${version}-win-x64.exe`
  const installer =
    asset &&
    typeof asset.name === 'string' &&
    INSTALLER_NAME.test(asset.name) &&
    typeof asset.size === 'number' &&
    asset.size > 0 &&
    asset.size < 500 * 1024 * 1024 &&
    asset.browser_download_url === expectedUrl &&
    (asset.digest == null || digest)
      ? {
          url: expectedUrl,
          name: asset.name,
          size: asset.size,
          sha256: digest?.[1]?.toLowerCase() ?? null,
        }
      : null
  return { version, releaseUrl, installer }
}

export class UpdateService {
  private stateValue: UpdateState = {
    phase: 'idle',
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseUrl: null,
    canDownload: false,
    progress: null,
    error: null,
  }
  private installer: Installer | null = null
  private downloadedPath: string | null = null
  private checkPromise: Promise<UpdateState> | null = null
  private downloadPromise: Promise<UpdateState> | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly notify: (state: UpdateState) => void) {}

  get state(): UpdateState {
    return { ...this.stateValue }
  }

  private setState(change: Partial<UpdateState>): UpdateState {
    this.stateValue = { ...this.stateValue, ...change }
    this.notify(this.state)
    return this.state
  }

  start(): void {
    void this.check().catch(() => undefined)
    this.timer = setInterval(
      () => {
        if (!this.downloadPromise) void this.check().catch(() => undefined)
      },
      6 * 60 * 60 * 1000,
    )
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  check(): Promise<UpdateState> {
    if (this.downloadPromise) return this.downloadPromise
    if (this.checkPromise) return this.checkPromise
    this.checkPromise = this.performCheck().finally(() => {
      this.checkPromise = null
    })
    return this.checkPromise
  }

  private async performCheck(): Promise<UpdateState> {
    const wasReady = this.stateValue.phase === 'ready'
    const readyVersion = wasReady ? this.stateValue.latestVersion : null
    if (!wasReady) this.setState({ phase: 'checking', error: null })
    try {
      const response = await net.fetch(RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ScreenTools' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}`)
      const release = parseRelease((await response.json()) as GithubRelease, app.getVersion())
      if (!release) {
        this.installer = null
        this.downloadedPath = null
        return this.setState({
          phase: 'idle',
          latestVersion: null,
          releaseUrl: null,
          canDownload: false,
          progress: null,
          error: null,
        })
      }
      if (readyVersion !== release.version) this.downloadedPath = null
      this.installer = release.installer
      const state = this.setState({
        phase: this.downloadedPath ? 'ready' : 'available',
        latestVersion: release.version,
        releaseUrl: release.releaseUrl,
        canDownload: !!release.installer && process.platform === 'win32',
        progress: this.downloadedPath ? 100 : null,
        error: null,
      })
      return state.phase === 'available' && state.canDownload ? this.download() : state
    } catch (error) {
      if (wasReady) return this.state
      return this.setState({
        phase: 'error',
        error: error instanceof Error ? error.message : '检查更新失败',
      })
    }
  }

  download(): Promise<UpdateState> {
    if (this.downloadPromise) return this.downloadPromise
    if (this.stateValue.phase === 'ready') return Promise.resolve(this.state)
    if (!this.installer || !this.stateValue.canDownload)
      return Promise.reject(new Error('当前版本没有可直接安装的更新包'))
    this.downloadPromise = this.performDownload(this.installer).finally(() => {
      this.downloadPromise = null
    })
    return this.downloadPromise
  }

  private async performDownload(installer: Installer): Promise<UpdateState> {
    this.setState({ phase: 'downloading', progress: 0, error: null })
    let directory: string | null = null
    try {
      directory = await mkdtemp(join(tmpdir(), 'screentools-update-'))
      const filePath = join(directory, installer.name)
      const response = await net.fetch(installer.url, {
        signal: AbortSignal.timeout(10 * 60 * 1000),
      })
      if (!response.ok || !response.body) throw new Error(`下载失败：HTTP ${response.status}`)
      const file = await open(filePath, 'wx')
      const reader = response.body.getReader()
      const hash = createHash('sha256')
      let bytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > installer.size) throw new Error('安装包大小与 GitHub 记录不符')
          hash.update(value)
          let offset = 0
          while (offset < value.byteLength) {
            const { bytesWritten } = await file.write(value, offset, value.byteLength - offset)
            if (bytesWritten === 0) throw new Error('安装包写入失败')
            offset += bytesWritten
          }
          const progress = Math.floor((bytes / installer.size) * 100)
          if (progress !== this.stateValue.progress) this.setState({ progress })
        }
      } catch (error) {
        await reader.cancel().catch(() => undefined)
        throw error
      } finally {
        await file.close()
      }
      if (bytes !== installer.size || (installer.sha256 && hash.digest('hex') !== installer.sha256))
        throw new Error('安装包校验失败，请重试')
      this.downloadedPath = filePath
      return this.setState({ phase: 'ready', progress: 100 })
    } catch (error) {
      if (directory) await rm(directory, { recursive: true, force: true })
      return this.setState({
        phase: 'error',
        progress: null,
        error: error instanceof Error ? error.message : '下载更新失败',
      })
    }
  }

  async install(): Promise<void> {
    if (this.stateValue.phase !== 'ready' || !this.downloadedPath)
      throw new Error('更新尚未下载完成')
    const error = await shell.openPath(this.downloadedPath)
    if (error) {
      this.setState({ error: `无法启动安装程序：${error}` })
      return
    }
    app.quit()
  }

  async openReleasePage(): Promise<void> {
    try {
      await shell.openExternal(this.stateValue.releaseUrl ?? RELEASES_URL)
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : '无法打开 GitHub 发布页' })
    }
  }
}
