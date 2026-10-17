export interface NativeBridgeStatus {
  available: boolean
  reason: string
}

export function getNativeBridgeStatus(): NativeBridgeStatus {
  return {
    available: false,
    reason: 'Native Windows display bridge has not been implemented yet.',
  }
}
