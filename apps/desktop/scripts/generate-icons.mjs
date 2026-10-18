// 由品牌 Logo（apps/website/public/logo.svg）生成应用图标资源。
// 纯 Node 实现：不依赖 sharp / ImageMagick。
// 产物写入 apps/desktop/build：icon.png、icon.ico。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../build')

// 与 logo.svg 的 64×64 设计稿保持一致（单位：设计稿像素）。
const DESIGN = 64
const BACKGROUND = { r: 0xff, g: 0x69, b: 0x0e }
const BACKGROUND_RADIUS = 16
const SCREEN = { x: 15, y: 16, w: 34, h: 26, r: 4 }
const STAND = [
  [32, 42],
  [32, 49],
]
const BASE = [
  [25, 49],
  [39, 49],
]
const STROKE = 3
const WHITE = { r: 0xff, g: 0xff, b: 0xff }

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
// ICO 全部使用未压缩 DIB：PNG 压缩条目虽被 Vista+ 支持，但部分图标解析库无法读取。
const ICO_DIB_MAX = 256

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

/** 圆角矩形有符号距离，负值在内部。 */
function roundedRectSdf(px, py, { x, y, w, h, r }) {
  const dx = px - clamp(px, x + r, x + w - r)
  const dy = py - clamp(py, y + r, y + h - r)
  return Math.hypot(dx, dy) - r
}

/** 点到线段距离。 */
function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const abx = bx - ax
  const aby = by - ay
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby), 0, 1)
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

/** 返回该点的颜色；透明处返回 null。白色描边绘制在橙色底之上。 */
function sampleColor(px, py) {
  const onStroke =
    Math.abs(roundedRectSdf(px, py, SCREEN)) <= STROKE / 2 ||
    segmentDistance(px, py, STAND[0], STAND[1]) <= STROKE / 2 ||
    segmentDistance(px, py, BASE[0], BASE[1]) <= STROKE / 2
  if (onStroke) return WHITE
  const onBackground =
    roundedRectSdf(px, py, { x: 0, y: 0, w: DESIGN, h: DESIGN, r: BACKGROUND_RADIUS }) <= 0
  return onBackground ? BACKGROUND : null
}

/** 超采样渲染为 RGBA 缓冲区，边缘按覆盖率抗锯齿。 */
function renderIcon(size) {
  const samples = Math.min(16, Math.max(4, Math.ceil(384 / size)))
  const coverage = samples * samples
  const data = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      let red = 0
      let green = 0
      let blue = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = ((x + (sx + 0.5) / samples) * DESIGN) / size
          const py = ((y + (sy + 0.5) / samples) * DESIGN) / size
          const color = sampleColor(px, py)
          if (!color) continue
          hits += 1
          red += color.r
          green += color.g
          blue += color.b
        }
      }
      if (hits === 0) continue
      const offset = (y * size + x) * 4
      data[offset] = Math.round(red / hits)
      data[offset + 1] = Math.round(green / hits)
      data[offset + 2] = Math.round(blue / hits)
      data[offset + 3] = Math.round((hits / coverage) * 255)
    }
  }
  return data
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** 32 位带 Alpha 的 DIB，供 ICO 内的小尺寸图标使用。 */
function encodeIcoDib(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(size * size * 4, 20)
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const sourceY = size - 1 - y
    for (let x = 0; x < size; x++) {
      const source = (sourceY * size + x) * 4
      const target = (y * size + x) * 4
      pixels[target] = rgba[source + 2]
      pixels[target + 1] = rgba[source + 1]
      pixels[target + 2] = rgba[source]
      pixels[target + 3] = rgba[source + 3]
    }
  }
  const maskStride = Math.ceil(size / 32) * 4
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)])
}

function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const directory = Buffer.alloc(entries.length * 16)
  const images = []
  let offset = 6 + entries.length * 16
  entries.forEach((entry, index) => {
    const base = index * 16
    const dimension = entry.size >= 256 ? 0 : entry.size
    directory[base] = dimension
    directory[base + 1] = dimension
    directory[base + 4] = 1
    directory[base + 6] = 32
    directory.writeUInt32LE(entry.data.length, base + 8)
    directory.writeUInt32LE(offset, base + 12)
    offset += entry.data.length
    images.push(entry.data)
  })
  return Buffer.concat([header, directory, ...images])
}

const rgbaBySize = new Map()
function rgbaFor(size) {
  if (!rgbaBySize.has(size)) rgbaBySize.set(size, renderIcon(size))
  return rgbaBySize.get(size)
}

const pngBySize = new Map()
function pngFor(size) {
  if (!pngBySize.has(size)) pngBySize.set(size, encodePng(size, rgbaFor(size)))
  return pngBySize.get(size)
}

const icoEntries = ICO_SIZES.map((size) => ({
  size,
  data: size <= ICO_DIB_MAX ? encodeIcoDib(size, rgbaFor(size)) : pngFor(size),
}))

mkdirSync(outputDir, { recursive: true })
writeFileSync(resolve(outputDir, 'icon.png'), pngFor(1024))
writeFileSync(resolve(outputDir, 'icon.ico'), encodeIco(icoEntries))
console.log(`已生成应用图标：${outputDir}`)
