export const enhanceChannels = {
  state: 'enhance:state',
  changed: 'enhance:changed',
} as const

export type EnhancePreset =
  'auto' | 'quality' | 'anime' | 'tensorrt' | 'balanced' | 'performance' | 'off'

export interface EnhanceSettings {
  preset: EnhancePreset
}

export interface EnhanceComponentState {
  available: boolean
  tensorrt: boolean
  directory: string | null
  version: string | null
  error: string | null
}

export interface EnhancePlaybackState {
  file: string
  title: string
  sourceFps: number | null
  outputFps: number | null
  droppedFrames: number
  position: number | null
  duration: number | null
  paused: boolean
}

export interface EnhanceWindow {
  hwnd: number
  title: string
  process: string
  rect: [number, number, number, number]
  monitor: [number, number, number, number]
}

export interface EnhanceCrop {
  x: number
  y: number
  width: number
  height: number
}

export interface EnhanceWindowSnapshot {
  dataUrl: string
  width: number
  height: number
}

export interface EnhanceWindowState {
  active: boolean
  visible: boolean
  hwnd: number | null
  title: string
  process: string
  error: string | null
}

export interface EnhanceState {
  component: EnhanceComponentState
  settings: EnhanceSettings
  playback: EnhancePlaybackState | null
  windowCapture: EnhanceWindowState
  error: string | null
}
