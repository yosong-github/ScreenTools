import { inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import type {
  AppSettings,
  DisplayDevice,
  HardwareCapabilities,
  NativeDisplay,
  ScreenFilterState,
} from '@screentools/contracts'

export interface TraySession {
  selected: ComputedRef<NativeDisplay | undefined>
  devices: ComputedRef<NativeDisplay[]>
  capabilities: ComputedRef<HardwareCapabilities>
  locked: ComputedRef<boolean>
  display: ComputedRef<DisplayDevice | undefined>
  scaleText: ComputedRef<string>
  settings: ComputedRef<AppSettings | undefined>
  launchAtLoginAvailable: ComputedRef<boolean>
  screenFilter: ComputedRef<ScreenFilterState | undefined>
}

const traySessionKey: InjectionKey<TraySession> = Symbol('traySession')

export function provideTraySession(session: TraySession): void {
  provide(traySessionKey, session)
}

export function useTraySession(): TraySession {
  const session = inject(traySessionKey)
  if (!session) throw new Error('页面必须放在托盘布局里渲染')
  return session
}
