import type { ControlCommand, ControlState } from './control'
import type {
  EnhanceCrop,
  EnhancePreset,
  EnhanceState,
  EnhanceWindow,
  EnhanceWindowSnapshot,
} from './enhance'
export * from './control'
export * from './enhance'

export const displayChannels = {
  snapshot: 'displays:snapshot',
  changed: 'displays:changed',
} as const

export interface DisplayRectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayDevice {
  id: string
  name: string
  connected: boolean
  primary: boolean
  internal: boolean
  bounds: DisplayRectangle
  workArea: DisplayRectangle
  pixelSize: { width: number; height: number }
  scaleFactor: number
  rotation: number
  refreshRate: number | null
  colorDepth: number | null
}

export interface DisplaySnapshot {
  capturedAt: string
  displays: DisplayDevice[]
  source: 'electron-screen'
  identity: 'session'
}

export interface UpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  latestVersion: string | null
  releaseUrl: string | null
  canDownload: boolean
  progress: number | null
  error: string | null
}

export interface ScreenToolsApi {
  platform: string
  version: string
  quitApp(): Promise<void>
  confirmInputSourceSwitch(): Promise<boolean>
  getUpdateState(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  installUpdate(): Promise<void>
  openUpdatePage(): Promise<void>
  onUpdateChanged(listener: (state: UpdateState) => void): () => void
  getDisplaySnapshot(): Promise<DisplaySnapshot>
  onDisplaysChanged(listener: () => void): () => void
  getControlState(): Promise<ControlState>
  onControlChanged(listener: () => void): () => void
  executeControl(command: ControlCommand): Promise<ControlState>
  getEnhanceState(): Promise<EnhanceState>
  listEnhanceWindows(): Promise<EnhanceWindow[]>
  captureEnhanceWindow(hwnd: number): Promise<EnhanceWindowSnapshot | null>
  startEnhanceWindow(target: EnhanceWindow, crop?: EnhanceCrop): Promise<EnhanceState>
  toggleEnhanceWindow(): Promise<EnhanceState>
  stopEnhanceWindow(): Promise<EnhanceState>
  chooseEnhanceComponent(): Promise<EnhanceState>
  openEnhanceVideo(file?: string): Promise<EnhanceState>
  stopEnhancePlayback(): Promise<EnhanceState>
  setEnhancePreset(preset: EnhancePreset): Promise<EnhanceState>
  onEnhanceChanged(listener: (state: EnhanceState) => void): () => void
}

export type DisplayId = string
export interface DisplaySummary {
  id: DisplayId
  name: string
  connected: boolean
  primary: boolean
}
