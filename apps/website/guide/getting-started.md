---
title: 快速开始
description: 在 Windows 上获取、启动和使用 ScreenTools。
---

# 快速开始

ScreenTools 目前主要面向 **Windows x64** 的显示器管理。启动后没有主窗口，点击系统托盘中的显示器图标即可展开操作面板。

## 获取应用

项目目前是硬件测试版本，尚未配置自动发布或在线更新。可以在 GitHub 的 [Package Desktop 工作流](https://github.com/yosong-github/ScreenTools/actions/workflows/package.yml) 中手动运行 Windows x64 打包，并从成功运行的 Artifacts 下载安装包；Artifact 默认保留 14 天。

也可以从源码构建：

```bash
pnpm install
pnpm build:win
```

安装包未配置发布者签名，首次安装时请核对下载来源。

安装向导完成页可勾选是否立即启动 ScreenTools。安装版默认开机自启动，可在“应用设置”或 Windows 的“启动应用”中随时关闭。

## 第一次使用

1. 如需调整显示器硬件亮度、对比度或输入源，先在显示器实体菜单中开启 **DDC/CI**。
2. 启动 ScreenTools，在系统托盘点击显示器图标。
3. 在“屏幕信息”查看当前设备与连接状态；在“画面配置”或“刷新率与清晰度”选择需要的操作。
4. 更改显示拓扑、分辨率等系统配置后，留意 **20 秒确认提示**。如果画面不符合预期，不要确认，等待自动恢复。

::: warning 操作提醒
切换输入源或关闭显示器可能使当前画面断开。只有在确认能使用显示器实体按键恢复时，再启用输入源切换。系统配置回滚也不能替代 Windows 显示设置或显示器实体按键。
:::

## 平台与能力

- Windows x64：提供 Win32 CCD 显示配置及 DDC/CI 硬件控制。
- macOS：当前可打包并运行界面，但尚不支持原生 CCD / DDC/CI 控制，不应视为正式硬件控制版本。
- 硬件亮度、对比度、音量、输入源及 HDR 是否可用，以显示器和驱动实际支持情况为准。

[返回功能预览 →](/features)
