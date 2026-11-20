import type { EnhancePreset } from '@screentools/contracts'

export const enhancePresets: readonly EnhancePreset[] = [
  'auto',
  'quality',
  'anime',
  'tensorrt',
  'balanced',
  'performance',
  'off',
]

const presetHeights: Record<'quality' | 'balanced' | 'performance', number> = {
  quality: 900,
  balanced: 720,
  performance: 540,
}

export function isEnhancePreset(value: unknown): value is EnhancePreset {
  return typeof value === 'string' && (enhancePresets as readonly string[]).includes(value)
}

// 生成的脚本只使用 ASCII，避免 PowerShell/文本编辑器写入 ANSI 后 VapourSynth 无法解析。
export function buildRifeScript(preset: EnhancePreset): string | null {
  if (preset === 'off') return null
  if (preset === 'tensorrt')
    return `import vapoursynth as vs
from vapoursynth import core
import k7sfunc as k7f

core.num_threads = k7f.vs_t_dft
clip = video_in

fps = container_fps if container_fps and container_fps > 0 else 24.0
if fps >= 40.0:
    clip.set_output()
else:
    H_Pre = 1080
    ret = k7f.FPS_CTRL(clip, fps_in=container_fps, fps_ret=True)
    clip = k7f.FMT_CTRL(clip, h_max=H_Pre, fmt_pix=0)
    clip = k7f.RIFE_NV(clip, model=4251, int8_qnt=False, turbo=2, fps_in=container_fps,
                       fps_num=2, fps_den=1, sc_mode=1, gpu=0, gpu_t=1, ws_size=0)
    clip.set_output()
`
  const height =
    preset === 'auto' || preset === 'anime'
      ? '900 if fps <= 26.0 else 720'
      : String(presetHeights[preset])
  return `import vapoursynth as vs
from vapoursynth import core
import k7sfunc as k7f

core.num_threads = k7f.vs_t_dft
clip = video_in

fps = container_fps if container_fps and container_fps > 0 else 24.0
if fps >= 40.0:
    clip.set_output()
else:
    H_Pre = ${height}
    ret = k7f.FPS_CTRL(clip, fps_in=container_fps, fps_ret=True)
    clip = k7f.FMT_CTRL(clip, h_max=H_Pre, fmt_pix=0)
    clip = k7f.RIFE_DML(clip, model=4251, turbo=True, fps_in=container_fps,
                        fps_num=2, fps_den=1, sc_mode=1, gpu=0, gpu_t=2)
    clip.set_output()
`
}
