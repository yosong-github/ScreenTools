const ICON_SIZE = 16

// 以托盘实际显示的 16px 网格为基准，避免线框在 Windows 再次缩放时发灰。
const MONITOR_PIXELS = [
  '................',
  '..############..',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '.#............#.',
  '..############..',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.....######.....',
  '................',
] as const

/** 透明底、单色实像素线框的屏幕图标；灰阶色值使位图通道顺序不影响外观。 */
export function renderMonitorTrayIcon(size: number, gray: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sourceX = Math.floor(((x + 0.5) * ICON_SIZE) / size)
      const sourceY = Math.floor(((y + 0.5) * ICON_SIZE) / size)
      const visible = MONITOR_PIXELS[sourceY]?.[sourceX] === '#'
      const offset = (y * size + x) * 4
      pixels[offset] = visible ? gray : 0
      pixels[offset + 1] = visible ? gray : 0
      pixels[offset + 2] = visible ? gray : 0
      pixels[offset + 3] = visible ? 255 : 0
    }
  }
  return pixels
}
