import { powerMonitor, screen } from 'electron'
import type { DisplayControlService } from '@screentools/display-control'

// 只读取当前活动桌面。CCD 稳定标识和可选模式列表由后续原生适配器提供。
export function createDisplayService(): DisplayControlService {
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function changed(): void {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!disposed) listeners.forEach((listener) => listener())
    }, 200)
  }

  screen.on('display-added', changed)
  screen.on('display-removed', changed)
  screen.on('display-metrics-changed', changed)
  powerMonitor.on('resume', changed)
  powerMonitor.on('unlock-screen', changed)

  return {
    async getSnapshot() {
      if (disposed) throw new Error('显示器服务已停止')
      const primaryId = screen.getPrimaryDisplay().id
      return {
        capturedAt: new Date().toISOString(),
        source: 'electron-screen',
        identity: 'session',
        displays: screen
          .getAllDisplays()
          .map((display) => ({
            id: String(display.id),
            name: display.label.trim() || `显示器 ${display.id}`,
            connected: true,
            primary: display.id === primaryId,
            internal: display.internal,
            bounds: display.bounds,
            workArea: display.workArea,
            // Windows 的 DIP 转换使用对应屏幕的缩放系数，避免混合 DPI 换算错误。
            pixelSize:
              process.platform === 'win32'
                ? screen.dipToScreenRect(null, display.bounds)
                : {
                    width: Math.round(display.size.width * display.scaleFactor),
                    height: Math.round(display.size.height * display.scaleFactor),
                  },
            scaleFactor: display.scaleFactor,
            rotation: display.rotation,
            refreshRate: display.displayFrequency > 0 ? display.displayFrequency : null,
            colorDepth: display.colorDepth > 0 ? display.colorDepth : null,
          }))
          .sort(
            (a, b) =>
              Number(b.primary) - Number(a.primary) ||
              a.bounds.x - b.bounds.x ||
              a.bounds.y - b.bounds.y ||
              a.id.localeCompare(b.id),
          ),
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      disposed = true
      clearTimeout(timer)
      listeners.clear()
      screen.removeListener('display-added', changed)
      screen.removeListener('display-removed', changed)
      screen.removeListener('display-metrics-changed', changed)
      powerMonitor.removeListener('resume', changed)
      powerMonitor.removeListener('unlock-screen', changed)
    },
  }
}
