import type { DisplaySummary } from '@screentools/contracts'

export interface DisplayState {
  displays: DisplaySummary[]
  loading: boolean
  error: string | null
}

export function createInitialDisplayState(): DisplayState {
  return {
    displays: [],
    loading: false,
    error: null,
  }
}
