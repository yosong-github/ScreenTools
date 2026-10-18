// 共享类型只参与编译期检查，不进行运行时数据校验。
export interface DisplayMode {
  width: number
  height: number
  refreshRate: number
}
export interface DisplaySetting {
  id: string
  mode: DisplayMode
  x: number
  y: number
  rotation: 0 | 90 | 180 | 270
  primary: boolean
  hdrEnabled?: boolean
}
export type HardwareFeature = 'brightness' | 'contrast' | 'volume' | 'inputSource' | 'power'
export interface HardwareSetting {
  id: string
  feature: HardwareFeature
  value: number
}
export interface ChangePlan {
  topology?: 'extend' | 'clone' | 'internal' | 'external'
  displays: DisplaySetting[]
  hardware: HardwareSetting[]
}
export interface DisplayProfile {
  id: string
  name: string
  plan: ChangePlan
}
export interface AppSettings {
  aliases: Record<string, string>
  closeToTray: boolean
  launchAtLogin: boolean
  theme: 'system' | 'light' | 'dark'
  shortcut: string
  startupProfileId: string | null
  connectProfileId: string | null
}
export const defaultSettings: AppSettings = {
  aliases: {},
  closeToTray: true,
  // 全新安装默认开启开机自启动（仅安装版生效），用户可随时在应用内关闭。
  launchAtLogin: true,
  theme: 'system',
  shortcut: 'CommandOrControl+Alt+D',
  startupProfileId: null,
  connectProfileId: null,
}
export type ControlCommand =
  | { type: 'refresh' }
  | { type: 'apply'; plan: ChangePlan }
  | { type: 'confirm'; token: string }
  | { type: 'revert'; token: string }
  | { type: 'probe'; id: string }
  | { type: 'hardware'; setting: HardwareSetting }
  | { type: 'save-profile'; profile: DisplayProfile }
  | { type: 'delete-profile'; id: string }
  | { type: 'apply-profile'; id: string }
  | { type: 'settings'; settings: AppSettings }
  | { type: 'export-diagnostics' }
  | { type: 'copy-diagnostics' }
  | { type: 'import-profiles' }
  | { type: 'export-profiles' }
  | { type: 'screen-filter'; filter: ScreenFilterId }
export interface NativeDisplay extends DisplaySetting {
  name: string
  connection: string
  modes: DisplayMode[]
  hdr: { supported: boolean; enabled: boolean } | null
}
export interface HardwareValue {
  min: number
  max: number
  current: number
  values?: number[] | undefined
}
export type HardwareCapabilities = Partial<Record<HardwareFeature, HardwareValue | undefined>>
export interface HardwareWriteRequest {
  setting: HardwareSetting
  capability: HardwareValue
}
export interface HardwarePollRequest {
  id: string
  capabilities: HardwareCapabilities
}
export interface PendingChange {
  token: string
  expiresAt: number
}
export type ScreenFilterId = 'off' | 'reading' | 'night' | 'grayscale'
export interface ScreenFilterState {
  available: boolean
  active: ScreenFilterId
  reason: string | null
}
export interface ControlState {
  devices: NativeDisplay[]
  profiles: DisplayProfile[]
  settings: AppSettings
  launchAtLoginAvailable: boolean
  capabilities: Record<string, HardwareCapabilities>
  pending: PendingChange | null
  screenFilter: ScreenFilterState
  error: string | null
  logs: { time: string; message: string }[]
}
