import { withBase } from 'vitepress'

export const downloadUrl = 'https://github.com/yosong-github/ScreenTools/releases/latest'
export const releasesUrl = 'https://github.com/yosong-github/ScreenTools/releases'
export const repoUrl = 'https://github.com/yosong-github/ScreenTools'
export const issuesUrl = 'https://github.com/yosong-github/ScreenTools/issues'

export function sitePath(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  if (path === '/') return withBase('/')
  const hashAt = path.indexOf('#')
  const hash = hashAt >= 0 ? path.slice(hashAt) : ''
  let pathname = hashAt >= 0 ? path.slice(0, hashAt) : path
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1)
  if (!pathname.endsWith('.html')) pathname = `${pathname}.html`
  return `${withBase(pathname)}${hash}`
}
