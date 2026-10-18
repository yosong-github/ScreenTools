import { describe, expect, it } from 'vitest'
import type { NativeDisplay } from '@screentools/contracts'
import { snapshotSettings } from '../src/renderer/src/utils/display-settings'
import { formatPixelSize, formatRefreshRate } from '../src/renderer/src/utils/display-format'

const primary: NativeDisplay = {
  id: 'primary',
  name: '主屏',
  connection: 'DisplayPort',
  mode: { width: 2560, height: 1440, refreshRate: 164.98 },
  modes: [],
  x: 0,
  y: 0,
  rotation: 0,
  primary: true,
  hdr: { supported: true, enabled: true },
}

describe('显示配置公共函数', () => {
  it('复制当前布局、模式和受支持的 HDR 状态，不修改设备缓存', () => {
    const settings = snapshotSettings([
      primary,
      {
        ...primary,
        id: 'secondary',
        primary: false,
        x: 2560,
        hdr: { supported: false, enabled: false },
      },
    ])

    expect(settings).toEqual([
      {
        id: 'primary',
        mode: { width: 2560, height: 1440, refreshRate: 164.98 },
        x: 0,
        y: 0,
        rotation: 0,
        primary: true,
        hdrEnabled: true,
      },
      {
        id: 'secondary',
        mode: { width: 2560, height: 1440, refreshRate: 164.98 },
        x: 2560,
        y: 0,
        rotation: 0,
        primary: false,
      },
    ])
    settings[0]!.mode.width = 1920
    expect(primary.mode.width).toBe(2560)
  })

  it('统一格式化尺寸和小数刷新率', () => {
    expect(formatPixelSize(2560, 1440)).toBe('2560 × 1440')
    expect(formatRefreshRate(164.98)).toBe('164.98')
    expect(formatRefreshRate(60)).toBe('60')
  })
})
