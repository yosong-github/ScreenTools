export interface NativeBridgeStatus {
  available: boolean
  reason: string
}

export function getNativeBridgeStatus(): NativeBridgeStatus {
  return {
    available: process.platform === 'win32' && process.arch === 'x64',
    reason: 'Windows x64 通过独立进程调用 CCD 和 DDC/CI；具体能力以设备探测结果为准。',
  }
}
