import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'

export class NativeClient {
  private child: ChildProcess | null = null
  private sequence = 0
  private pendingChange = false
  private unsafeExit = false
  private requests = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  constructor(private readonly changed: (error?: string) => void = () => {}) {}

  private start(): ChildProcess {
    if (this.unsafeExit)
      throw new Error(
        '显示变更工作进程意外退出，无法确认回滚；请先在 Windows 显示设置检查配置，再重启应用',
      )
    if (process.platform !== 'win32' || process.arch !== 'x64')
      throw new Error('原生控制目前仅支持 Windows x64')
    if (this.child) return this.child
    const child = fork(join(__dirname, 'native-worker.js'), [], {
      execPath: process.execPath,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    })
    this.child = child
    child.stderr?.on('data', () => {
      /* 原生错误通过 IPC 返回，避免将设备路径写入日志。 */
    })
    child.on(
      'message',
      (message: { id?: number; result?: unknown; error?: string; event?: string }) => {
        if (message.event) {
          if (!message.error) this.pendingChange = false
          this.changed(message.error)
          return
        }
        const request = this.requests.get(message.id ?? -1)
        if (!request) return
        clearTimeout(request.timer)
        this.requests.delete(message.id!)
        if (message.error) request.reject(new Error(message.error))
        else request.resolve(message.result)
      },
    )
    const failed = (): void => {
      if (this.child !== child) return
      this.child = null
      if (this.pendingChange) {
        this.unsafeExit = true
        this.changed('显示变更工作进程意外退出，自动恢复未获确认，请检查 Windows 显示设置')
      }
      for (const request of this.requests.values()) {
        clearTimeout(request.timer)
        request.reject(new Error('原生工作进程已退出'))
      }
      this.requests.clear()
    }
    child.on('error', failed)
    child.on('exit', failed)
    return child
  }

  request<T>(operation: string, payload?: unknown, timeout = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      const child = this.start(),
        id = ++this.sequence
      if (operation === 'apply') this.pendingChange = true
      const timer = setTimeout(() => {
        this.requests.delete(id)
        reject(new Error('设备响应超时，请重新探测'))
      }, timeout)
      this.requests.set(id, {
        resolve: (value) => {
          if (operation === 'confirm' || operation === 'revert') this.pendingChange = false
          resolve(value as T)
        },
        reject,
        timer,
      })
      child.send({ id, operation, payload }, (error) => {
        if (error) {
          clearTimeout(timer)
          this.requests.delete(id)
          reject(error)
        }
      })
    })
  }

  async dispose(): Promise<void> {
    const child = this.child
    if (!child) return
    try {
      await this.request('dispose', undefined, 5000)
    } finally {
      if (child.connected) child.disconnect()
    }
  }
  terminateReadWorker(): void {
    // 此方法只用于从未承载显示变更的 DDC 工作进程。
    this.child?.kill()
  }
}
