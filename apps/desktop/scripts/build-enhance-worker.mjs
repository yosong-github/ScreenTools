import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const sourceDir = join(appDir, 'native', 'enhance-worker')
const buildDir = join(sourceDir, 'build')
const distDir = join(sourceDir, 'dist')
const distFile = join(distDir, 'enhance-worker.exe')

if (process.platform !== 'win32') {
  if (!existsSync(distFile)) {
    console.error(
      `[enhance-worker] ${distFile} is missing.\n` +
        'The worker uses Windows Graphics Capture, so it cannot be built on this platform.\n' +
        'Build it on Windows first and place enhance-worker.exe in native/enhance-worker/dist/.',
    )
    process.exit(1)
  }
  console.log(`[enhance-worker] using prebuilt ${distFile}`)
  process.exit(0)
}

const cmake = spawnSync('cmake', ['--version'], { stdio: 'ignore' })
if (cmake.error || cmake.status !== 0) {
  console.error('[enhance-worker] cmake was not found. Install CMake and Visual Studio C++ tools.')
  process.exit(1)
}

const generators = ['Visual Studio 18 2026', 'Visual Studio 17 2022', 'Visual Studio 16 2019']
let lastStatus = 1

for (const generator of generators) {
  rmSync(buildDir, { recursive: true, force: true })
  console.log(`[enhance-worker] configuring with ${generator}`)
  const configure = spawnSync(
    'cmake',
    ['-S', sourceDir, '-B', buildDir, '-G', generator, '-A', 'x64'],
    { stdio: 'inherit' },
  )
  if (configure.status !== 0) {
    lastStatus = configure.status ?? 1
    continue
  }

  console.log('[enhance-worker] building Release')
  const build = spawnSync('cmake', ['--build', buildDir, '--config', 'Release'], {
    stdio: 'inherit',
  })
  if (build.status !== 0) {
    lastStatus = build.status ?? 1
    continue
  }

  const candidates = [
    join(buildDir, 'Release', 'enhance-worker.exe'),
    join(buildDir, 'enhance-worker.exe'),
  ]
  const built = candidates.find((candidate) => existsSync(candidate))
  if (!built) {
    console.error('[enhance-worker] build succeeded but enhance-worker.exe was not found')
    lastStatus = 1
    continue
  }

  mkdirSync(distDir, { recursive: true })
  copyFileSync(built, distFile)
  console.log(`[enhance-worker] wrote ${distFile}`)
  process.exit(0)
}

console.error(
  `[enhance-worker] build failed. Tried: ${generators.join(', ')}. ` +
    'Install Visual Studio C++ build tools or place a prebuilt exe in native/enhance-worker/dist/.',
)
process.exit(lastStatus || 1)
