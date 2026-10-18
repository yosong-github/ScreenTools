import type { DisplaySetting, NativeDisplay } from '@screentools/contracts'

export function snapshotSettings(devices: readonly NativeDisplay[]): DisplaySetting[] {
  return devices.map((device) => ({
    id: device.id,
    mode: { ...device.mode },
    x: device.x,
    y: device.y,
    rotation: device.rotation,
    primary: device.primary,
    ...(device.hdr?.supported ? { hdrEnabled: device.hdr.enabled } : {}),
  }))
}
