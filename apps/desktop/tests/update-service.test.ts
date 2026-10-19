import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { app, net, shell } from 'electron'

vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.1', isPackaged: true, quit: vi.fn() },
  net: { fetch: vi.fn() },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
}))

import { UpdateService, compareVersions, parseRelease } from '../src/main/services/update-service'

const version = '0.3.0'
const tag = `v${version}`
const name = `ScreenTools-${version}-win-x64.exe`
const url = `https://github.com/yosong-github/ScreenTools/releases/download/${tag}/${name}`
const release = {
  tag_name: tag,
  html_url: `https://github.com/yosong-github/ScreenTools/releases/tag/${tag}`,
  assets: [{ name, size: 123, digest: `sha256:${'a'.repeat(64)}`, browser_download_url: url }],
}

describe('GitHub 更新版本', () => {
  it('按数值比较版本，不把相同或更旧版本视为更新', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1)
    expect(compareVersions('v0.2.1', '0.2.1')).toBe(0)
    expect(parseRelease(release, '0.3.0')).toBeNull()
    expect(parseRelease(release, '0.4.0')).toBeNull()
  })

  it('只接受匹配版本、仓库下载地址和 SHA-256 摘要的安装包', () => {
    expect(parseRelease(release, '0.2.1')).toMatchObject({
      version,
      installer: { name, url, size: 123, sha256: 'a'.repeat(64) },
    })
    expect(
      parseRelease({ ...release, assets: [{ ...release.assets[0], digest: null }] }, '0.2.1'),
    ).toMatchObject({ version, installer: null })
    expect(
      parseRelease(
        {
          ...release,
          assets: [{ ...release.assets[0], browser_download_url: 'https://example.com/setup.exe' }],
        },
        '0.2.1',
      ),
    ).toMatchObject({ version, installer: null })
  })

  it('下载并校验安装包后才允许启动安装', async () => {
    const contents = new TextEncoder().encode('installer fixture')
    const digest = createHash('sha256').update(contents).digest('hex')
    const fixture = {
      ...release,
      assets: [{ ...release.assets[0], size: contents.length, digest: `sha256:${digest}` }],
    }
    vi.mocked(net.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }))
      .mockResolvedValueOnce(new Response(contents, { status: 200 }))
    vi.mocked(shell.openPath).mockResolvedValueOnce('')
    const service = new UpdateService(vi.fn())
    await service.check()
    expect(service.state.phase).toBe('available')
    await service.download()
    expect(service.state).toMatchObject({ phase: 'ready', progress: 100 })
    await service.install()
    expect(shell.openPath).toHaveBeenCalledOnce()
    expect(app.quit).toHaveBeenCalledOnce()
    const path = vi.mocked(shell.openPath).mock.calls[0]![0]
    await rm(dirname(path), { recursive: true, force: true })
  })

  it('摘要不匹配时拒绝安装', async () => {
    const contents = new TextEncoder().encode('installer fixture')
    vi.mocked(net.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...release,
            assets: [{ ...release.assets[0], size: contents.length }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(contents, { status: 200 }))
    const service = new UpdateService(vi.fn())
    await service.check()
    await service.download()
    expect(service.state).toMatchObject({ phase: 'error', error: '安装包校验失败，请重试' })
    await expect(service.install()).rejects.toThrow('更新尚未下载完成')
  })
})
