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

## 本地打包

```bash
pnpm build:unpack # release/win-unpacked
pnpm build:win    # Windows x64 NSIS 安装包
pnpm build:mac    # 在 Mac 上构建当前架构的 DMG 和 ZIP
```

安装包未配置发布者签名或在线更新服务；当前为硬件测试版本。开发版与安装版数据隔离，设置和方案写入 Electron userData 下的 `control.json`，最近 200 条操作写入 `operations.json`。开机启动仅支持安装版。

模式写入、多屏热插拔、扩展坞、HDR 与硬件电源控制仍需按文档进行实机验收。独立进程回滚不等于绝对黑屏保护：驱动挂起、系统崩溃或工作进程被强杀可能阻止恢复；软件会报告未确认状态，必要时使用 Windows 显示设置恢复。

## GitHub Actions 手动打包

1. 将工作流推送 / 合并到 GitHub 仓库默认分支。
2. 打开 **Actions → Package Desktop → Run workflow**，选择分支及要构建的平台。
3. 默认同时构建 Windows x64、macOS arm64（Apple Silicon）与 macOS x64（Intel）；取消对应勾选可只打包一个平台。
4. 成功后在该次运行的 **Artifacts** 下载对应平台的 EXE 或 DMG / ZIP，保留 14 天。

手动构建会先执行 lint、格式检查、类型检查、测试和生产构建，再打包；失败不会上传安装包。工作流不创建 GitHub Release、不自动发布、不需要额外的签名 Secrets。普通 push（main / master）和 PR 由 CI 工作流检查。

macOS 包使用 ad-hoc 签名，未使用 Apple Developer ID 签名或公证，下载后可能受到 Gatekeeper 限制，不属于正式发行包。正式对外分发需另行配置证书和公证。

**可打包 macOS 不代表已支持 macOS 原生显示器控制**：目前 macOS 可运行界面及 Electron 设备概览，CCD / DDC/CI 控制仍仅支持 Windows x64，界面会提示原生控制不可用。

参考：[GitHub 手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[electron-builder macOS 配置](https://www.electron.build/v26/docs/mac/)。

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
