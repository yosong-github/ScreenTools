# 画质增强 M1：内置增强播放

## 1. 目标与范围

M1 提供一个独立的 mpv 增强播放窗口，用来播放本地视频：

- **超分**：mpv 的 Lanczos/FSRCNNX 放大；
- **插帧**：VapourSynth + vs-mlrt DirectML + RIFE，把 24/30fps 视频补到 48/60fps；
- **自动选档**：按视频帧率选择处理分辨率，避免在 3060 Laptop 上掉帧；
- **应用内控制**：托盘面板新增「画质增强」页，负责组件检测、预设、打开/停止播放和状态显示。

M1 **不做**系统级任意窗口捕获，也不处理 DRM 内容；这两项属于 M2/M3。

## 2. 架构

```text
Vue「画质增强」页
  → preload API / IPC
  → EnhanceService（主进程）
      → 选择组件目录、保存 enhance.json
      → 生成 VapourSynth 脚本
      → spawn mpv.exe（独立窗口）
      → 命名管道 IPC 轮询播放状态
  → mpv.exe（cwd = 增强组件目录）
      → VapourSynth（嵌入式 Python）
      → k7sfunc.RIFE_DML
      → vs-mlrt / vsort / ONNX Runtime DirectML
      → RIFE Lite50 模型
      → FSRCNNX 或 ewa_lanczos 放大
```

- 模型推理不在 Electron 主进程中执行，主进程只负责进程、脚本和状态。
- 播放窗口使用 mpv 自带的 OSC；面板失焦会自动收起，按 `Ctrl+Alt+D` 或托盘图标重新打开。
- 视频解码、音频、字幕、音画同步全部交给 mpv，M1 不需要额外处理音频延迟。

## 3. 增强组件

M1 不把 mpv/VapourSynth/RIFE 打进安装包，而是读取一个外部「增强组件目录」。开发版默认路径：

```text
%APPDATA%\@screentools\desktop-dev\enhance
```

也可以在「画质增强 → 增强组件」中选择任意可写目录，或设置环境变量：

```powershell
$env:SCREENTOOLS_ENHANCE_DIR = "D:\path\to\mpv-lazy"
pnpm dev
```

### 3.1 组件来源

当前开发验证使用 **mpv_PlayKit / mpv-lazy 20260510 标准包**（含 DirectML 版 VapourSynth）：

1. 下载 `mpv-lazy-20260510.exe`：
   <https://github.com/hooke007/mpv_PlayKit/releases/tag/20260510>
2. 用 7-Zip 解压（该文件是 7z 自解压包），得到 `mpv-lazy/`。
3. 将 RIFE Lite50 模型放到：

   ```text
   vs-plugins/models/rife_v2/rife_v4.25_lite.onnx
   ```

   `k7sfunc` 的 `model=4251` 固定读取这个文件名。模型必须是 vs-mlrt RIFE v1 布局（7 通道：`img0(3) + img1(3) + timestep(1)`）。

4. 可选：添加 `screentools-component.json`，用于页面显示版本：

   ```json
   { "version": "mpv-lazy-20260510 + RIFE Lite50" }
   ```

5. 在应用内选择该目录。

### 3.2 组件校验

应用要求目录中存在：

```text
mpv.exe
VSScript.dll
Lib/site-packages/vapoursynth.dll
Lib/site-packages/k7sfunc/__init__.py
vs-plugins/vsort.dll
vs-plugins/vsort/onnxruntime.dll
vs-plugins/vsort/DirectML.dll
vs-plugins/models/rife_v2/rife_v4.25_lite.onnx
```

TensorRT 预设额外要求（可选）：

```text
vs-plugins/vstrt.dll
vs-plugins/vsmlrt-cuda/trtexec.exe
vs-plugins/vsmlrt-cuda/nvinfer_10.dll
vs-plugins/vsmlrt-cuda/nvinfer_plugin_10.dll
vs-plugins/vsmlrt-cuda/（CUDA 12 + cuDNN 9 + cuFFT/cuRAND DLL）
```

当前开发组件使用 TensorRT 10.16 + VSTRT v15.16；`vsmlrt-cuda` 目录约 5GB，仅用于本机验证。正式分发应把它拆成独立的「TensorRT 质量包」，不要塞进默认安装包。

目录必须可写，应用会在 `screentools/rife.vpy` 生成 VapourSynth 脚本。若悬停/选择后提示缺少文件，先按上面的路径检查。

### 3.3 许可证提醒

当前组件仅用于开发验证，**不要直接随安装包分发**：

- mpv：GPL；
- VapourSynth：LGPL；
- vs-mlrt / vsort：需按上游许可证处理；
- RIFE 模型：当前来自第三方整合包，来源与许可证尚未确认，正式发布前必须替换为可确认许可证的模型，或从 Practical-RIFE 自行导出。

后续如果要做正式分发，建议把组件做成**独立可选下载包**，附带第三方声明与源码链接，并在安装包中提供版本/校验信息。

## 4. 预设

| 预设      |    处理高度 | 插帧规则                                            | 放大方式    | 实测（RTX 3060 Laptop）            |
| --------- | ----------: | --------------------------------------------------- | ----------- | ---------------------------------- |
| 自动      |        动态 | 24fps → 900p/48fps；30fps → 720p/60fps；≥40fps 关闭 | ewa_lanczos | 24fps 0 丢帧，30fps 0 丢帧         |
| 质量      |         900 | 24→48 / 30→60；≥40fps 关闭                          | ewa_lanczos | 24→48 可用；30→60 也可用，余量较小 |
| 2K AI     |        动态 | 24fps → 900p/48fps；30fps → 720p/60fps；≥40fps 关闭 | modernAnime | 24fps 4 丢帧/15s；30fps 5 丢帧/15s |
| TRT 1080p | 1080（TRT） | 24→48 / 30→60；≥40fps 关闭                          | modernAnime | 24fps 6 丢帧/15s；30fps 9 丢帧/15s |
| 均衡      |         720 | 24→48 / 30→60；≥40fps 关闭                          | FSRCNNX     | 24fps 3 丢帧；30fps 11 丢帧        |
| 性能      |         540 | 24→48 / 30→60；≥40fps 关闭                          | FSRCNNX     | 适合弱 GPU                         |
| 关闭      |           — | 不插帧                                              | ewa_lanczos | 原始帧率播放                       |

自动预设的脚本逻辑：

```python
fps = container_fps
if fps >= 40.0:
    clip.set_output()            # 高帧率不插帧
else:
    H_Pre = 900 if fps <= 26.0 else 720
    ... RIFE 2x ...
```

- 2 倍插帧：24→48fps、30→60fps；不尝试 60→120。
- 900p/720p 是**处理分辨率**，最终由 mpv 放大到窗口/全屏尺寸。
- 2K AI / TRT 1080p 使用 `portable_config/shaders/Ani/k7_modernAnime_FHD_x2.glsl`，面向动画/CG；实拍建议用质量/均衡。
- TRT 1080p 使用 TensorRT（VSTRT + TensorRT 10.16）在 1080p 原生插帧，再用 modernAnime 放大到 2K；首次播放会构建引擎，约 2–3 分钟。
- 自动与质量档使用 Lanczos 而不是 FSRCNNX，是因为 900p 再跑 FSRCNNX x2 会明显增加 GPU 压力；M0 实测 1440p 输出时 24fps 出现 15 次丢帧。

### 2K 输出实测

以下均为 2K（2560×1440）窗口、15 秒、同一台 RTX 3060 Laptop；丢帧数受后台 GPU 占用影响，但趋势稳定：

| 管线                                 | 24→48fps | 30→60fps |
| ------------------------------------ | -------: | -------: |
| 720p 插帧 + modernAnime              |        5 |        5 |
| 720p 插帧 + FSRCNNX                  |        3 |       11 |
| 720p 插帧 + Anime4K GAN              |        4 |       29 |
| 900p 插帧 + modernAnime              |        4 |       63 |
| 900p 插帧 + ewa_lanczos              |        0 |        5 |
| 1080p 插帧 + ewa_lanczos（DirectML） |      208 |      668 |
| TensorRT 1080p + ewa                 |        0 |        2 |
| TensorRT 1080p + modernAnime         |        6 |        9 |
| 先 Lanczos 放大到 2K，再插帧         |      444 |      558 |

结论：

- **最强实时 2K 组合**是 **TensorRT 1080p 原生插帧**：+ ewa 为 24fps 0 丢帧、30fps 2 丢帧；+ modernAnime 为 24fps 6 丢帧、30fps 9 丢帧（AI 超分更锐利）。
- 没有 TensorRT 时，退而求其次是 720p 插帧 + modernAnime（24/30fps 各 5 丢帧）或 720p + FSRCNNX（更通用，30fps 11 丢帧）。
- 900p 插帧在 24fps 可用（modernAnime 4 丢帧），30fps 明显掉帧（63 丢帧）。
- **DirectML 下的 1080p 插帧不稳定**（208/668 丢帧）；2K-first 最慢（444/558 丢帧），不要采用。TensorRT 下 2K 原生插帧的 GPU 计算虽然只有约 20ms，但 VapourSynth 的 CPU 放大链路仍会掉帧，因此实时管线应始终**先插帧、后超分**。

## 5. 交互

- 打开「画质增强」页：
  - 组件未就绪：显示缺少的文件，提供「选择组件目录」；
  - 组件就绪：显示路径、预设、打开视频、播放状态。
- 「打开视频」使用系统文件对话框，支持 mp4/mkv/webm/mov/avi 等。
- 播放中切换预设会**自动重启当前视频**并应用新预设。
- 状态每秒刷新：源帧率 → 输出帧率、丢帧数、播放进度。
- mpv 窗口内按 `F` 全屏、`Esc` 退出；关闭 mpv 窗口后应用状态自动回到「未播放」。

首次打开视频需要初始化 DirectML 会话，实测约 **3–8 秒**；之后换预设重启仍需重新初始化。

## 6. 已验证

在 RTX 3060 Laptop / Windows 11 / mpv-lazy 20260510 + RIFE Lite50 上：

| 场景                                   | 结果                                   |
| -------------------------------------- | -------------------------------------- |
| 1080p30 自动（720p 处理）              | 30 → 60fps，9 秒后丢帧 0               |
| 1080p24 自动（900p 处理）              | 24 → 48fps，12 秒后丢帧 0              |
| 1080p24 2K AI（900p+modernAnime）      | 24 → 48fps，2K 输出，15 秒约 4 丢帧    |
| 1080p30 2K AI（720p+modernAnime）      | 30 → 60fps，2K 输出，15 秒约 5 丢帧    |
| 1080p24 TRT 1080p + ewa                | 24 → 48fps，2K 输出，15 秒 0 丢帧      |
| 1080p30 TRT 1080p + ewa                | 30 → 60fps，2K 输出，15 秒 2 丢帧      |
| 1080p24 TRT 1080p + modernAnime        | 24 → 48fps，2K 输出，15 秒 6 丢帧      |
| 1080p30 TRT 1080p + modernAnime        | 30 → 60fps，2K 输出，15 秒 9 丢帧      |
| TensorRT 2K-first（Lanczos 2K + RIFE） | 掉帧明显（531/15s），不采用            |
| 播放中切换到「关闭」                   | 24 → 24fps，状态正常，无残留连接错误   |
| 播放中切换到「均衡」                   | 24 → 48fps，丢帧 0                     |
| 组件自动检测（dev 数据目录）           | 通过                                   |
| Playwright UI 检查                     | 5 个标签页、增强页布局、预设切换均正常 |

## 7. 限制

- **不是任意程序增强**：M1 只能播放本地视频文件；浏览器、其他播放器、游戏属于 M2/M3。
- **DRM 内容、HDR**：M1 未处理；受保护视频可能黑屏，HDR 色彩未验证。
- **24fps 快速运动**：遮挡、快速摇镜可能出现插帧瑕疵；这是 RIFE 的共性限制。
- **DirectML 下 1080p 实时插帧不可行**：单帧约 49ms；实测 1080p 24→48 丢 208 帧/15s。TensorRT 下 1080p 原生插帧可行（见上表）。
- **2K-first（先放大再插帧）不实时**：TensorRT 2K 计算本身约 20ms，但 VapourSynth 的 CPU 放大链路实测丢 531 帧/15s；实时管线应始终先插帧、后超分。
- **2K AI / TRT 1080p 面向动画/CG**：modernAnime 对实拍可能过锐或产生纹理；实拍优先质量/均衡（ewa）。
- **TensorRT 首次构建**：1080p 引擎约 128–160 秒，期间 mpv 窗口可能黑屏；引擎按 GPU/分辨率缓存，之后加载约 1–2 秒。
- **组件体积**：带 TensorRT 的组件约 5GB（其中 TensorRT + CUDA/cuDNN 约 4.5GB）；正式分发应拆成独立质量包。
- **独立窗口**：mpv 使用自己的窗口和控件，尚未嵌入 Electron；面板失焦会收起。
- **组件手动安装**：M1 没有下载/更新器，组件路径保存在 `enhance.json`。

## 8. 代码位置

| 文件                                                          | 作用                                         |
| ------------------------------------------------------------- | -------------------------------------------- |
| `packages/contracts/src/enhance.ts`                           | IPC/状态类型、增强通道                       |
| `apps/desktop/src/main/services/enhance-scripts.ts`           | 纯函数生成 VapourSynth 脚本、预设校验        |
| `apps/desktop/src/main/services/enhance-service.ts`           | 组件校验、mpv 进程、命名管道状态轮询、持久化 |
| `apps/desktop/src/main/ipc.ts`                                | `enhance:*` IPC                              |
| `apps/desktop/src/main/index.ts`                              | 服务生命周期                                 |
| `apps/desktop/src/preload/index.ts`                           | 渲染层 API                                   |
| `apps/desktop/src/renderer/src/stores/enhance.ts`             | Pinia 状态                                   |
| `apps/desktop/src/renderer/src/views/enhance/EnhanceView.vue` | 画质增强页面                                 |
| `apps/desktop/tests/enhance-scripts.test.ts`                  | 脚本生成测试                                 |

## 9. 下一步

- **M2**：后台常驻，WGC 捕获前台窗口，FSR 超分，无边框输出窗口。
- **M3**：捕获链路接 RIFE，WASAPI 进程回环 + 音频延迟同步，自动识别全屏视频。
- M1.5（可选）：组件下载/校验/更新；mpv 嵌入 Electron；TensorRT 1080p 质量包。
