import { Menu, Tray, nativeImage } from 'electron'
import type { ControlService } from './services/control-service'

export function createTray(service: ControlService, show: () => void, quit: () => void): Tray {
  // 使用应用内生成的像素图标，无需依赖外部图标文件。
  const pixels = Buffer.alloc(24 * 24 * 4)
  for (let y = 4; y < 19; y++)
    for (let x = 2; x < 22; x++) {
      const offset = (y * 24 + x) * 4
      pixels[offset] = 240
      pixels[offset + 1] = 180
      pixels[offset + 2] = 90
      pixels[offset + 3] = 255
    }
  const tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 24, height: 24 }))
  tray.setToolTip('ScreenTools 显示器控制')
  tray.on('click', show)
  tray.on('right-click', () => {
    const state = service.state
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: '打开控制中心', click: show },
        {
          label: '快速拓扑',
          enabled: !state.pending,
          submenu: (['extend', 'clone', 'internal', 'external'] as const).map(
            (topology, index) => ({
              label: ['扩展', '复制', '仅电脑屏幕', '仅外接屏幕'][index]!,
              click: () => {
                void service
                  .execute({ type: 'apply', plan: { topology, displays: [], hardware: [] } })
                  .catch(show)
              },
            }),
          ),
        },
        ...state.devices.map((d) => ({
          label: state.settings.aliases[d.id] || d.name,
          enabled: !state.pending,
          submenu: [
            {
              label: '探测硬件能力',
              click: () => {
                void service.execute({ type: 'probe', id: d.id }).catch(show)
              },
            },
            ...[25, 50, 75, 100].map((value) => ({
              label: `亮度 ${value}%`,
              enabled: !!state.capabilities[d.id]?.brightness,
              click: () => {
                void service
                  .execute({
                    type: 'hardware',
                    setting: { id: d.id, feature: 'brightness', value },
                  })
                  .catch(show)
              },
            })),
          ],
        })),
        { type: 'separator' },
        ...state.profiles.map((profile) => ({
          label: profile.name,
          enabled: !state.pending,
          click: () => {
            void service.execute({ type: 'apply-profile', id: profile.id }).catch(show)
          },
        })),
        { type: 'separator' },
        { label: '退出', click: quit },
      ]),
    )
  })
  return tray
}
