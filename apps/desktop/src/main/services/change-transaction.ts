import { randomUUID } from 'node:crypto'

// 倒计时由原生工作进程持有，不依赖窗口或渲染进程是否正常响应。
export function createChangeTransaction<T>(
  driver: {
    capture: () => T
    restore: (snapshot: T) => void
    persist: () => void
    changed: (error?: string) => void
  },
  duration = 20000,
) {
  let pending: {
    token: string
    snapshot: T
    expiresAt: number
    timer: ReturnType<typeof setTimeout>
  } | null = null
  function revert(token?: string): void {
    if (!pending) return
    if (token && token !== pending.token) throw new Error('变更凭据不匹配')
    driver.restore(pending.snapshot)
    clearTimeout(pending.timer)
    pending = null
    driver.changed()
  }
  function apply(operation: () => void): { token: string; expiresAt: number } {
    if (pending) throw new Error('请先确认或恢复上一次变更')
    const snapshot = driver.capture()
    const token = randomUUID(),
      expiresAt = Date.now() + duration
    const timer = setTimeout(() => {
      try {
        revert()
      } catch (error) {
        driver.changed(String(error))
      }
    }, duration)
    pending = { token, snapshot, expiresAt, timer }
    try {
      operation()
    } catch (error) {
      revert()
      throw error
    }
    return { token, expiresAt }
  }
  function confirm(token: string): void {
    if (!pending || pending.token !== token || Date.now() >= pending.expiresAt)
      throw new Error('确认已过期或凭据无效')
    driver.persist()
    clearTimeout(pending.timer)
    pending = null
  }
  return { apply, confirm, revert }
}
