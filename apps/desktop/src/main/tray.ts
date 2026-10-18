import { app, Menu, Tray, nativeImage, nativeTheme } from 'electron'
import type { NativeImage } from 'electron'
import type { ControlService } from './services/control-service'
import { renderMonitorTrayIcon } from './tray-icon'

function monitorTrayImage(): NativeImage {
  const darkSystem =
    process.platform === 'win32'
      ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
      : nativeTheme.shouldUseDarkColors
  const gray = darkSystem ? 245 : 32
  const image = nativeImage.createFromBitmap(renderMonitorTrayIcon(16, gray), {
    width: 16,
    height: 16,
  })
  for (const size of [20, 24, 32]) {
    image.addRepresentation({
      scaleFactor: size / 16,
      width: size,
      height: size,
      buffer: renderMonitorTrayIcon(size, gray),
    })
  }
  return image
}

export function createTray(service: ControlService, show: () => void, quit: () => void): Tray {
  const tray = new Tray(monitorTrayImage())
  const updateIcon = (): void => tray.setImage(monitorTrayImage())
  nativeTheme.on('updated', updateIcon)
  app.once('before-quit', () => nativeTheme.removeListener('updated', updateIcon))
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
        { label: '退出', click: quit },
      ]),
    )
  })
  return tray
}
