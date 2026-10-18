import { describe, expect, it } from 'vitest'
import { useHardwareSliderDraft } from '../src/renderer/src/components/tray/hardware/useHardwareSliderDraft'

describe('硬件滑块草稿', () => {
  it('写入期间保持拖动值，不短暂回退到设备旧值', async () => {
    const slider = useHardwareSliderDraft()
    let complete!: (value: boolean) => void
    const writing = new Promise<boolean>((resolve) => {
      complete = resolve
    })
    slider.preview('display-1', 'brightness', 70)
    const pending = slider.commit('display-1', 'brightness', 70, () => writing)

    expect(slider.current('display-1', 'brightness', 20)).toBe(70)
    expect(slider.current('display-2', 'brightness', 35)).toBe(35)

    complete(true)
    expect(await pending).toBe(true)
    expect(slider.current('display-1', 'brightness', 70)).toBe(70)
  })

  it('写入失败后恢复实际值', async () => {
    const slider = useHardwareSliderDraft()
    expect(await slider.commit('display-1', 'volume', 80, async () => false)).toBe(false)
    expect(slider.current('display-1', 'volume', 25)).toBe(25)
  })
})
