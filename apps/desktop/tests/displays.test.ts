import type { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import type { DisplaySnapshot } from '@screentools/contracts'

const bridge = vi.hoisted(() => ({
  getDisplaySnapshot: vi.fn(),
  onDisplaysChanged: vi.fn(() => vi.fn()),
}))
vi.mock('@renderer/api/screen-tools', () => ({ screenTools: bridge }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    screen: Object.assign(new EventEmitter(), {
      getPrimaryDisplay: () => ({ id: 7 }),
      getAllDisplays: vi.fn(() => [
        {
          id: 7,
          label: '测试显示器',
          internal: false,
          bounds: { x: -1280, y: 0, width: 1280, height: 720 },
          workArea: { x: -1280, y: 0, width: 1280, height: 680 },
          size: { width: 1280, height: 720 },
          scaleFactor: 1.5,
          rotation: 0,
          displayFrequency: 0,
          colorDepth: 24,
        },
      ]),
      dipToScreenRect: () => ({ x: -1920, y: 0, width: 1920, height: 1080 }),
    }),
    powerMonitor: new EventEmitter(),
  }
})

import { screen, powerMonitor } from 'electron'
import { createDisplayService } from '../src/main/services/display-service'
import { useDisplaysStore } from '../src/renderer/src/stores/displays'

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('显示器读取与事件生命周期', () => {
  it('保留负坐标，换算像素尺寸，不伪造未知刷新率', async () => {
    const service = createDisplayService()
    try {
      const snapshot = await service.getSnapshot()
      expect(snapshot.displays[0]).toMatchObject({
        primary: true,
        bounds: { x: -1280 },
        pixelSize: { width: 1920, height: 1080 },
        refreshRate: null,
      })
      expect(snapshot.identity).toBe('session')
    } finally {
      service.dispose()
    }
  })

  it('合并热插拔事件，唤醒时更新，销毁时取消计时器并移除监听', () => {
    vi.useFakeTimers()
    const baseline = screen.listenerCount('display-added')
    const service = createDisplayService()
    const listener = vi.fn()
    service.subscribe(listener)
    const events = screen as unknown as EventEmitter
    events.emit('display-added')
    events.emit('display-removed')
    vi.advanceTimersByTime(200)
    expect(listener).toHaveBeenCalledTimes(1)
    ;(powerMonitor as unknown as EventEmitter).emit('resume')
    vi.advanceTimersByTime(200)
    expect(listener).toHaveBeenCalledTimes(2)
    events.emit('display-added')
    service.dispose()
    vi.advanceTimersByTime(200)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(screen.listenerCount('display-added')).toBe(baseline)
  })
})

describe('显示器状态恢复', () => {
  it('读取失败保留快照，设备移除后清空选择，停止后忽略迟到结果', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const service = createDisplayService()
    try {
      const snapshot = await service.getSnapshot()
      bridge.getDisplaySnapshot
        .mockResolvedValueOnce(snapshot)
        .mockRejectedValueOnce(new Error('读取失败'))
        .mockResolvedValueOnce({ ...snapshot, displays: [] })
      const store = useDisplaysStore()
      await store.refresh()
      expect(store.selectedId).toBe('7')
      await store.refresh()
      expect(store.snapshot).toEqual(snapshot)
      expect(store.error).not.toBeNull()
      await store.refresh()
      expect(store.selectedId).toBeNull()
      expect(store.error).toBeNull()
      let finish!: (value: DisplaySnapshot) => void
      bridge.getDisplaySnapshot.mockReturnValueOnce(
        new Promise<DisplaySnapshot>((resolve) => {
          finish = resolve
        }),
      )
      const task = store.refresh()
      store.stop()
      finish(snapshot)
      await task
      expect(store.displays).toEqual([])
    } finally {
      service.dispose()
      disposePinia(pinia)
    }
  })
})
