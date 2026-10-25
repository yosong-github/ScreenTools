---
title: 快速开始
description: 在 Windows 上获取、启动和使用 ScreenTools。
---

# 快速开始

ScreenTools 仅支持 **Windows x64**。启动后没有主窗口，点击系统托盘中的显示器图标即可展开操作面板。

## 获取应用

从 [GitHub 最新版本发布页](https://github.com/yosong-github/ScreenTools/releases/latest) 的 **Assets** 下载 `ScreenTools-版本号-win-x64.exe`。需要旧版本可查看[全部版本](https://github.com/yosong-github/ScreenTools/releases)；`Source code` 压缩包不是安装程序。

发布流程会先创建 Release，再构建并上传 EXE。如果暂时只看到源码包，请等待 Windows 构建结束后刷新页面。安装包未配置发布者签名。应用会检查本仓库的最新 GitHub Release；发现新版本时，设置图标会显示红点，安装包会在应用内下载，需要在“应用设置 → 版本更新”里确认后才会安装。首次安装请核对下载来源。

也可以从源码构建：

```bash
pnpm install
pnpm build:win
```

安装向导完成页可勾选是否立即启动 ScreenTools。安装版默认开机自启动，可在“应用设置”或 Windows 的“启动应用”中随时关闭。

## 第一次使用

1. 如需调整显示器硬件亮度、对比度或输入源，先在显示器实体菜单中开启 **DDC/CI**。
2. 启动 ScreenTools，在系统托盘点击显示器图标。
3. 在“屏幕信息”查看当前设备与连接状态；在“画面配置”或“刷新率与清晰度”选择需要的操作。要改变整个桌面的颜色，打开第四个页面“屏幕滤镜”。
4. 更改显示拓扑、分辨率等系统配置后，留意 **20 秒确认提示**。如果画面不符合预期，不要确认，等待自动恢复。屏幕滤镜不会进入这套确认，点击后立即生效。

## 屏幕滤镜

屏幕滤镜在托盘的第四个标签页里。它使用 Windows 的全屏颜色矩阵，作用到所有显示器，不改某一台显示器的硬件亮度。预设、自定义方案、快捷键和不能启用时的提示，见[设置屏幕滤镜](/guide/screen-filter)。

::: warning 操作提醒
切换输入源或关闭显示器可能使当前画面断开。只有在确认能使用显示器实体按键恢复时，再启用输入源切换。系统配置回滚也不能替代 Windows 显示设置或显示器实体按键。
:::

## 平台与能力

- Windows x64：提供 Win32 CCD 显示配置及 DDC/CI 硬件控制。
- 硬件亮度、对比度、音量、输入源及 HDR 是否可用，以显示器和驱动实际支持情况为准。

[返回功能预览 →](/features) · [设置屏幕滤镜 →](/guide/screen-filter)
