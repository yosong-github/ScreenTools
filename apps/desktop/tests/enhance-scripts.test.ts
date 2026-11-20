import { describe, expect, it } from 'vitest'
import {
  buildRifeScript,
  enhancePresets,
  isEnhancePreset,
} from '../src/main/services/enhance-scripts'

describe('enhance scripts', () => {
  it('recognizes only supported presets', () => {
    expect(enhancePresets).toEqual([
      'auto',
      'quality',
      'anime',
      'tensorrt',
      'balanced',
      'performance',
      'off',
    ])
    for (const preset of enhancePresets) expect(isEnhancePreset(preset)).toBe(true)
    expect(isEnhancePreset('ultra')).toBe(false)
    expect(isEnhancePreset(null)).toBe(false)
  })

  it('returns no script when interpolation is disabled', () => {
    expect(buildRifeScript('off')).toBeNull()
  })

  it('selects the processing height automatically', () => {
    const script = buildRifeScript('auto')
    expect(script).toContain('H_Pre = 900 if fps <= 26.0 else 720')
    expect(script).toContain('if fps >= 40.0')
    expect(script).toContain('model=4251')
    expect(script).toContain('fps_num=2')
    expect(script).toContain('RIFE_DML')
    expect(script).toContain('clip.set_output()')
  })

  it('uses the automatic height for the 2K AI preset', () => {
    const script = buildRifeScript('anime')
    expect(script).toContain('H_Pre = 900 if fps <= 26.0 else 720')
    expect(script).toContain('if fps >= 40.0')
    expect(script).toContain('model=4251')
  })

  it('generates a TensorRT 1080p script', () => {
    const script = buildRifeScript('tensorrt')
    expect(script).toContain('H_Pre = 1080')
    expect(script).toContain('RIFE_NV')
    expect(script).toContain('ws_size=0')
    expect(script).not.toContain('RIFE_DML')
  })

  it.each([
    ['quality', '900'],
    ['balanced', '720'],
    ['performance', '540'],
  ] as const)('uses a fixed %s height', (preset, height) => {
    const script = buildRifeScript(preset)
    expect(script).toContain(`H_Pre = ${height}`)
    expect(script).toContain('if fps >= 40.0')
    expect(script).toContain('model=4251')
  })

  it('writes ASCII-only scripts for VapourSynth', () => {
    for (const preset of enhancePresets) {
      const script = buildRifeScript(preset)
      if (script) expect([...script].every((character) => character.charCodeAt(0) < 128)).toBe(true)
    }
  })
})
