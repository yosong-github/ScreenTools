export interface ScreenToolsApi {
  platform: string
  version: string
}

export type DisplayId = string

export interface DisplaySummary {
  id: DisplayId
  name: string
  connected: boolean
  primary: boolean
}
