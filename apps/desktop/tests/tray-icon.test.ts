import { describe, expect, it } from 'vitest'
import { renderMonitorTrayIcon } from '../src/main/tray-icon'

function alphaAt(pixels: Buffer, size: number, x: number, y: number): number {
  return pixels[(y * size + x) * 4 + 3]!
}

describe('托盘显示器图标', () => {
  it.each([16, 20, 24, 32])('%i 像素尺寸保持透明镂空和清晰的底座', (size) => {
    const pixels = renderMonitorTrayIcon(size, 245)
    const coordinate = (value: number): number => Math.floor(((value + 0.5) * size) / 16)
    expect(pixels).toHaveLength(size * size * 4)
    expect(alphaAt(pixels, size, 0, 0)).toBe(0)
    expect(alphaAt(pixels, size, coordinate(8), coordinate(6))).toBe(0)
    expect(alphaAt(pixels, size, coordinate(8), coordinate(1))).toBe(255)
    expect(alphaAt(pixels, size, coordinate(8), coordinate(12))).toBe(255)
    expect(alphaAt(pixels, size, coordinate(8), coordinate(14))).toBe(255)
  })

  it('16 像素基准图占满 14 × 14 像素区域', () => {
    const pixels = renderMonitorTrayIcon(16, 32)
    expect(alphaAt(pixels, 16, 1, 2)).toBe(255)
    expect(alphaAt(pixels, 16, 14, 2)).toBe(255)
    expect(alphaAt(pixels, 16, 8, 14)).toBe(255)
    expect(alphaAt(pixels, 16, 0, 2)).toBe(0)
    expect(alphaAt(pixels, 16, 15, 2)).toBe(0)
  })

  it('所有尺寸只使用实色像素，避免多次缩放造成半透明虚边', () => {
    for (const size of [16, 20, 24, 32]) {
      const pixels = renderMonitorTrayIcon(size, 32)
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const alpha = pixels[offset + 3]!
        expect(alpha === 0 || alpha === 255).toBe(true)
        expect(pixels[offset]).toBe(pixels[offset + 1])
        expect(pixels[offset]).toBe(pixels[offset + 2])
        expect(pixels[offset]).toBe(alpha === 255 ? 32 : 0)
      }
    }
  })
})
