# 画质增强 M2：任意窗口捕获（原型）

## 1. 目标

选择任意 Windows 应用/窗口（例如哔哩哔哩客户端），捕获它的画面，做超分后覆盖输出；不再需要 mpv 或 5GB 的 TensorRT 视频组件。

M2 只做**超分**；插帧、音频延迟和自动音画同步属于 M3。

## 2. 当前原型

源码：`apps/desktop/native/enhance-worker/`

```text
apps/desktop/native/enhance-worker/
├─ CMakeLists.txt
├─ src/main.cpp
├─ build/              # 编译中间文件（gitignore）
└─ dist/               # 打包用 enhance-worker.exe（gitignore）
```

推荐用桌面应用的脚本编译，它会依次尝试 Visual Studio 2026 / 2022 / 2019，并把产物复制到 `dist/enhance-worker.exe`：

```powershell
pnpm --filter @screentools/desktop build:enhance-worker
```

也可以手动编译：

```powershell
cmake -S apps\desktop\native\enhance-worker -B apps\desktop\native\enhance-worker\build -G "Visual Studio 18 2026" -A x64
cmake --build apps\desktop\native\enhance-worker\build --config Release
```

手动编译后，把 `build\Release\enhance-worker.exe` 复制到 `dist\enhance-worker.exe`。

`build:win` / `build:unpack` 会先运行上面的脚本再调用 electron-builder。非 Windows 平台无法编译（依赖 WGC），需要先把 Windows 下编好的 `enhance-worker.exe` 放到 `dist/`，否则打包会失败。

命令：

```powershell
enhance-worker.exe --list
enhance-worker.exe --capture <hwnd> 15
```

- `--list`：输出可见顶层窗口的 hwnd、标题、进程、窗口矩形、显示器矩形（JSON Lines）。
- `--snapshot <hwnd> <png>`：用 PrintWindow 输出客户区截图，供 UI 框选视频区域。
- `--capture`：使用 Windows Graphics Capture（WGC）捕获指定窗口，创建无边框置顶覆盖窗口并显示画面。
- `--capture <hwnd> [seconds] --crop x y w h`：只显示客户区中的指定子区域，并等比铺到目标显示器。

直接运行 worker 时没有全局热键（快捷键由 Electron 主进程注册）；开发时用时间参数或结束进程停止。

打包：`apps/desktop/electron-builder.yml` 通过 `extraResources` 把 `native/enhance-worker/dist/enhance-worker.exe` 放到 `resources/`；worker 使用静态 VC 运行库（`/MT`），目标机器不需要额外安装 Visual C++ Redistributable。`beforePack` 钩子会检查 `dist/enhance-worker.exe`，文件缺失时直接让打包失败，不会静默生成缺少窗口增强组件的安装包。

已验证：

- 能列出并捕获哔哩哔哩客户端窗口（`哔哩哔哩.exe`）；
- 覆盖窗口在其他应用（Edge 等）之上持续显示被捕获的 B 站画面；
- WGC 捕获在窗口被其他窗口遮挡时仍能拿到内容；
- **输入转发**：在 B 站客户端点击「评论/简介」标签可正常切换；在 Edge 测试页点击输入框后可继续键盘输入；
- **客户区裁剪**：WGC 的窗口帧包含边框/标题栏时，按 DWM 扩展边框和 `GetClientRect` 裁到客户区，覆盖画面不显示标题栏。

当前版本已经支持：

- **全屏等比缩放**：覆盖窗口铺满目标显示器，画面按源窗口比例居中，bicubic 缩放；
- **窗口选择 UI**：Electron「画质增强 → 窗口增强」列出窗口，选择后开始/停止；
- **视频区域框选**：在窗口截图上拖拽框出视频画面，只把这一块等比铺满显示器；不带侧边栏/标题栏，视频本身不切边；目标窗口大小和位置不变；
- **鼠标转发**：移动/左键/右键/滚轮按缩放比例映射回原窗口客户区；优先投递到鼠标下的子窗口；
- **键盘**：覆盖窗口为 no-activate，点击画面后键盘焦点留在原窗口；
- **快速 A/B**：`Ctrl+Alt+G` 隐藏/显示覆盖层，直接对比增强画面与原窗口；恢复时重新置顶；快捷键由 Electron 主进程用 `globalShortcut` 注册，再通过 `WM_APP+1` 通知 worker；
- **切换提示**：每次切换在目标显示器顶部显示 1.8 秒浮层「画质增强：已开启 / 已关闭 · 原画面」，点击穿透、不抢焦点；
- **热键停止**：`Ctrl+Alt+Shift+E`（同样由 Electron 注册）；
- **生命周期**：目标窗口关闭或进程退出时自动停止；Electron 侧会显示 worker 的错误输出和覆盖层可见状态。

注意：覆盖层是全屏置顶的，会盖住 ScreenTools 面板本身；停止时使用热键，或先用键盘切到其他方式。

## 3. 关键限制

- **捕获的是应用最终渲染结果**。如果 B 站/浏览器已经把 1080p 视频放大到 2583×1883 或 4K，WGC 拿到的是放大后的画面，超分只能改善锐度/边缘，无法恢复原始 1080p 细节。
  - 最佳场景：让播放器窗口保持 1920×1080（或更低），再由 M2 覆盖到 1440p/4K。
  - 全屏 4K 播放器本身已经是 4K 输出，收益会明显变小。
- **DRM 内容**：受保护视频可能黑屏；普通视频通常可捕获。
- **输入映射**：鼠标事件已按等比缩放映射回原窗口客户区（`PostMessage`）；键盘焦点保持在原窗口。
  - 已在 B 站客户端和 Edge 验证点击、滚轮、键盘输入可用。
  - 使用 Raw Input 的程序（部分游戏）可能不响应合成鼠标消息，需要后续做低级鼠标钩子或 `SendInput` 方案。
  - 依赖 `SetCapture` 的拖拽控件（部分进度条/滑块）可能不跟随；后续需要补拖拽状态或低级钩子。
  - 如果原窗口不在前台，先单击覆盖层，worker 会尝试激活原窗口；激活后键盘输入才会进入原窗口。
  - 目标窗口最小化或关闭时，覆盖层会自动停止。
- **A/B 切换的尺寸**：`Ctrl+Alt+G` 关闭覆盖层后显示的是原窗口本身；覆盖层是全屏，原窗口可能是窗口化大小。想要同尺寸对比，请先把目标窗口设为全屏或最大化。
- **框选区域**：框选坐标相对窗口客户区；目标窗口改变大小/布局或切换到别的视频后，需要重新框选。部分 UWP/DRM 窗口的 PrintWindow 截图可能为空或黑屏。
- **HDR/10-bit**：当前按 SDR BGRA8 处理。
- **独占全屏**：WGC 对独占全屏/部分硬件覆盖层可能失败；窗口化或无边框全屏更可靠。
- **多显示器/DPI**：当前按物理像素和窗口所在显示器处理，后续需要完善跨屏/缩放。

## 4. 下一步

1. **超分 shader**：当前 bicubic 只是高质量缩放；下一阶段接 FSR1 EASU/RCAS 或 Anime4K/FSRCNNX。
2. **输入转发增强**：为 Raw Input 程序补低级鼠标钩子/`SendInput`，并支持拖拽期间的捕获状态；完善多显示器坐标。
3. **窗口跟踪**：目标窗口移动/缩放/最小化时自动更新覆盖层和捕获尺寸。
4. **常驻与热键**：从前台窗口一键开始捕获、托盘状态；当前已有 `Ctrl+Alt+G` 切换和 `Ctrl+Alt+Shift+E` 停止。
5. **M3**：RIFE 插帧、WASAPI 音频延迟、音画同步、自动识别全屏视频。

## 5. B 站客户端测试建议

1. 打开 B 站普通视频（非 DRM）；
2. 让播放器窗口保持 1080p 左右，或全屏；
3. 在 ScreenTools 的窗口列表中选择 `哔哩哔哩.exe` 对应的视频窗口；
4. 开始增强后，覆盖窗口会显示放大的画面；鼠标点击/滚轮会转发回 B 站，键盘快捷键也应可用；
5. 若出现黑屏，先确认是否为 DRM 内容或独占全屏。
