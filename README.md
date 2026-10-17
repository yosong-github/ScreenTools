# ScreenTools

Windows x64 本机显示器管理工具，通过 Win32 CCD 和 DDC/CI 控制显示设备，不依赖云服务。

支持设备概览、模式与布局编辑、拓扑切换、HDR / 高级颜色、能力探测、亮度 / 对比度 / 音量、方案管理、托盘、快捷键与脱敏诊断。系统配置提交后需在 20 秒内确认，否则尝试恢复原配置。

## 技术栈

- pnpm workspace
- Electron
- Vue 3
- Pinia、共享 TypeScript 类型
- Koffi Node-API（独立进程调用 Windows API）
- TypeScript
- Vite 和 electron-vite
- ESLint 和 Prettier
- Vitest
- Husky、lint-staged 和 Commitlint

## 开发

```bash
pnpm install
pnpm dev
```

先在显示器 OSD 菜单开启 DDC/CI。设备自动只读探测，失败后可手动重试。复制模式无法唯一匹配物理设备时，先切换扩展模式。输入源与电源控制可能使当前屏幕断开，只在确认可以使用实体按键恢复时操作。

## Windows 打包

```bash
pnpm build:unpack # release/win-unpacked
pnpm build:win    # Windows x64 NSIS 安装包
```

安装包未配置发布者签名或在线更新服务；当前为硬件测试版本。开发版与安装版数据隔离，设置和方案写入 Electron userData 下的 `control.json`，最近 200 条操作写入 `operations.json`。开机启动仅支持安装版。

模式写入、多屏热插拔、扩展坞、HDR 与硬件电源控制仍需按文档进行实机验收。独立进程回滚不等于绝对黑屏保护：驱动挂起、系统崩溃或工作进程被强杀可能阻止恢复；软件会报告未确认状态，必要时使用 Windows 显示设置恢复。

## 质量检查

```bash
pnpm check
```

提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如：

```text
feat: add display overview shell
fix: close the window safely
docs: update architecture notes
```

产品与技术说明见 [docs/显示器管理控制软件说明.md](docs/显示器管理控制软件说明.md)。
