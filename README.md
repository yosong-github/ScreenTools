<h1 align="center">
  <img src="apps/website/public/logo.svg" alt="ScreenTools Logo" width="120" />
  <br />
  ScreenTools
</h1>

<p align="center"><strong>你的显示器，一眼掌握。</strong></p>

<p align="center">
  在 Windows 托盘中查看显示状态、调整画面与硬件参数、切换刷新率与分辨率。<br />
  基于 Win32 CCD 与 DDC/CI，所有控制都留在本机，不依赖云服务。
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="#平台支持"><img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg" alt="Platform: Windows x64" /></a>
  <a href="#技术栈"><img src="https://img.shields.io/badge/Electron-Vue%203-2C3E50.svg" alt="Powered by Electron and Vue 3" /></a>
</p>

<p align="center">
  <a href="apps/website/features.md">功能预览</a> ·
  <a href="apps/website/guide/getting-started.md">快速开始</a> ·
  <a href="https://yosong-github.github.io/ScreenTools/">在线官网</a> ·
  <a href="https://github.com/yosong-github/ScreenTools/issues">问题反馈</a>
</p>

---

## 简介

ScreenTools 是一个面向 **Windows x64** 的本机显示器管理工具。它以托盘面板为主界面，没有常驻主窗口，把常用的显示器操作集中在一处：

- 通过 **Win32 CCD** 读取并切换显示拓扑、分辨率与刷新率；
- 通过 **DDC/CI** 读取并写入显示器硬件亮度、对比度、音量与输入源；
- 所有数据与设置保存在本机，不经过任何云端服务。

对于会中断画面的系统级配置（如显示拓扑、HDR），应用会在提交后要求 **20 秒内确认**，否则尝试恢复原有配置，降低黑屏风险。

## 功能

| 页面              | 能力                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| 🖥️ 屏幕信息       | 分辨率、刷新率、主屏状态、连接方式与输入源；支持时调节硬件亮度与内置音量                             |
| 🎛️ 画面配置       | 扩展 / 复制 / 仅主屏 / 仅外屏拓扑切换，日间、阅读、观影、夜间场景，硬件亮度、对比度与 HDR / 高级颜色 |
| ⚡ 刷新率与清晰度 | 按显示器上报的模式切换刷新率与分辨率，不展示设备未提供的选项                                         |

除此之外还提供：

- **托盘常驻面板**：点击图标即用，三个页面覆盖查看、配置与切换；
- **方案管理**：保存并复用显示配置方案；
- **快捷键与开机启动**（安装版默认开启，可随时关闭）；
- **脱敏诊断**：导出不含敏感信息的运行日志，便于排查问题。

> 实际可用的能力取决于显示器与驱动是否支持对应的 DDC/CI 命令。请在显示器 OSD 菜单中开启 **DDC/CI** 后再进行硬件参数调节。

## 界面

<p align="center">
  <img src="apps/website/public/images/screen-info.png" alt="屏幕信息页面" width="32%" />
  <img src="apps/website/public/images/picture-settings.png" alt="画面配置页面" width="32%" />
  <img src="apps/website/public/images/display-modes.png" alt="刷新率与清晰度页面" width="32%" />
</p>

## 平台支持

| 平台        | 界面 | CCD / DDC/CI 原生控制 | 说明                                                 |
| ----------- | :--: | :-------------------: | ---------------------------------------------------- |
| Windows x64 |  ✅  |          ✅           | 主要支持平台                                         |
| macOS       |  ✅  |      ⚠️ 暂不支持      | 可运行界面与设备概览，原生控制不可用，界面会给出提示 |

## 技术栈

- **运行时**：Electron、Vue 3、Pinia
- **原生调用**：Koffi（Node-API FFI），在独立进程内调用 Windows API
- **构建与语言**：TypeScript、Vite、electron-vite、UnoCSS
- **工程质量**：ESLint、Prettier、Vitest、Husky、lint-staged、Commitlint
- **官网**：VitePress
- **包管理**：pnpm workspace

## 项目结构

```text
ScreenTools/
├─ apps/
│  ├─ desktop/          # Electron 桌面应用（main / preload / renderer）
│  └─ website/          # VitePress 官网
├─ packages/
│  ├─ contracts/        # 共享 TypeScript 契约与 IPC 通道定义
│  ├─ display-core/     # 与平台无关的显示逻辑
│  ├─ display-control/  # DisplayControlService 接口与编排
│  └─ display-native/   # Koffi 绑定的 Windows CCD / DDC/CI 实现
└─ .github/workflows/    # 打包与官网部署工作流
```

桌面应用的主进程运行在 Node 侧，通过独立的 `native-worker` 进程加载 Koffi 调用 Win32 API；渲染进程仅通过 preload 暴露的类型化接口访问能力，不直接接触原生调用。

## 开发

**环境要求**：Node.js ≥ 24、pnpm ≥ 11。

```bash
pnpm install   # 安装依赖
pnpm dev       # 启动桌面应用（electron-vite）
```

官网位于 `apps/website`，使用 VitePress：

```bash
pnpm --filter @screentools/website dev
pnpm --filter @screentools/website build
```

官网通过 GitHub Pages 发布。首次使用时，在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；此后将官网或其依赖配置的修改推送到 `main`，`Deploy Website` 工作流会自动构建并部署到 <https://yosong-github.github.io/ScreenTools/>，也可以在 Actions 页面手动运行。站点使用 `/ScreenTools/` 作为路径前缀。

## 本地打包

```bash
pnpm build:unpack # release/win-unpacked
pnpm build:win    # Windows x64 NSIS 安装包
pnpm build:mac    # 在 Mac 上构建当前架构的 DMG 和 ZIP
```

安装包未配置发布者签名或在线更新服务，当前为硬件测试版本。开发版与安装版数据隔离，设置和方案写入 Electron `userData` 下的 `control.json`，最近 200 条操作写入 `operations.json`。安装向导完成页可勾选是否立即启动；开机启动仅支持安装版，全新安装默认开启。

模式写入、多屏热插拔、扩展坞、HDR 与硬件电源控制仍需按文档进行实机验收。独立进程回滚不等于绝对黑屏保护：驱动挂起、系统崩溃或工作进程被强杀可能阻止恢复；软件会报告未确认状态，必要时请使用 Windows 显示设置恢复。

## GitHub Actions 手动打包

1. 将工作流推送 / 合并到 GitHub 仓库默认分支。
2. 打开 **Actions → Package Desktop → Run workflow**，选择分支及要构建的平台。
3. 默认同时构建 Windows x64、macOS arm64（Apple Silicon）与 macOS x64（Intel）；取消对应勾选可只打包一个平台。
4. 成功后在该次运行的 **Artifacts** 下载对应平台的 EXE 或 DMG / ZIP，保留 14 天。

手动构建会先执行 lint、格式检查、类型检查、测试和生产构建，再打包；失败不会上传安装包。工作流不创建 GitHub Release、不自动发布、不需要额外的签名 Secrets。

macOS 包使用 ad-hoc 签名，未使用 Apple Developer ID 签名或公证，下载后可能受到 Gatekeeper 限制，不属于正式发行包。正式对外分发需另行配置证书和公证。

**可打包 macOS 不代表已支持 macOS 原生显示器控制**：目前 macOS 可运行界面及 Electron 设备概览，CCD / DDC/CI 控制仍仅支持 Windows x64。

参考：[GitHub 手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[electron-builder macOS 配置](https://www.electron.build/v26/docs/mac/)。

## 质量检查

```bash
pnpm check   # lint + 格式检查 + 类型检查 + 测试 + 生产构建
```

提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如：

```text
feat: add display overview shell
fix: close the window safely
docs: update architecture notes
```

## 安全提醒

- 切换输入源或关闭显示器可能使当前画面断开，请仅在确认可以使用显示器实体按键恢复时操作。
- 独立进程回滚不能替代 Windows 显示设置或显示器实体按键，驱动挂起、系统崩溃或进程被强杀都可能阻止自动恢复。
- 复制模式下无法唯一匹配物理设备时，请先切换到扩展模式。

## 贡献

欢迎提交 Issue 与 Pull Request。参与开发前请先运行 `pnpm check` 并通过全部检查，并遵循 Conventional Commits 提交规范。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
