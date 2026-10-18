# 全屏自定义滤镜最小实现

## 1. 目标

在 ScreenTools 中提供几个内置滤镜，用户点击后立即改变整个 Windows 桌面的颜色，并可一键恢复原色。

这不是 ICC 校色。MVP 使用 Windows Magnification API 的 `MagSetFullscreenColorEffect`，向整个桌面应用一个 5×5 颜色矩阵。它适合做暖色、暗色、灰度等线性颜色效果，不需要透明覆盖窗口，也不修改显示器硬件参数。

## 2. MVP 范围

首版提供四个固定选项：

| ID          | 名称 | 效果                       |
| ----------- | ---- | -------------------------- |
| `off`       | 原色 | 恢复启用滤镜前的颜色矩阵   |
| `reading`   | 阅读 | 轻度降低蓝色和绿色         |
| `night`     | 夜间 | 降低整体亮度并明显减少蓝色 |
| `grayscale` | 灰度 | 将 RGB 转为灰阶            |

限制：

- 滤镜作用于整个桌面和全部显示器，Windows API 不支持只处理某一台显示器；
- 同一时间只能启用一个滤镜；
- 首版不提供矩阵编辑器、强度滑块、定时切换和快捷键；
- 不保证影响独占全屏游戏、受保护视频、远程桌面或 HDR 内容；
- 不与 Windows 放大镜、系统颜色滤镜或其他调用同一 API 的程序叠加。

因此 UI 必须标注“应用到所有显示器”，不能把它描述成当前显示器的独立设置。

## 3. 用户界面

在托盘面板增加独立的第四个 Tab“屏幕滤镜”，Tab 内展示全局滤镜卡片：

```text
屏幕滤镜                         所有显示器
[ 原色 ] [ 阅读 ] [ 夜间 ] [ 灰度 ]
仅在 ScreenTools 运行期间生效
```

交互规则：

1. 点击滤镜后立即应用，不进入 20 秒显示配置确认流程。
2. 当前滤镜按钮使用已有的 `chosen` 选中样式。
3. 点击“原色”恢复 ScreenTools 启用滤镜前读取到的系统颜色矩阵。
4. 应用失败时保持旧选中状态，并复用页面底部错误提示。
5. 当 API 不可用或检测到其他程序已经设置颜色效果时禁用卡片，并展示原因。

## 4. 滤镜定义

新增 `packages/display-core/src/screen-filters.ts`。矩阵是纯数据和纯函数，便于测试；不要把矩阵散落在 Vue 或 Win32 代码中。

```ts
import type { ScreenFilterId } from '@screentools/contracts'

export type ColorMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export interface ScreenFilterPreset {
  id: Exclude<ScreenFilterId, 'off'>
  label: string
  matrix: ColorMatrix
}
```

初始矩阵：

```ts
export const identityMatrix: ColorMatrix = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
]

export const screenFilterPresets: readonly ScreenFilterPreset[] = [
  {
    id: 'reading',
    label: '阅读',
    matrix: [1, 0, 0, 0, 0, 0, 0.92, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  },
  {
    id: 'night',
    label: '夜间',
    matrix: [0.82, 0, 0, 0, 0, 0, 0.68, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  },
  {
    id: 'grayscale',
    label: '灰度',
    // 与微软文档示例一致。
    matrix: [
      0.3, 0.3, 0.3, 0, 0, 0.6, 0.6, 0.6, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
    ],
  },
]
```

这些数值只是产品初始值，需要在 SDR 实机上验收后微调。首版只允许仓库代码定义的有限矩阵，不接收用户提供的任意 25 个浮点数。

## 5. 共享契约

修改 `packages/contracts/src/control.ts`：

```ts
export type ScreenFilterId = 'off' | 'reading' | 'night' | 'grayscale'

export interface ScreenFilterState {
  available: boolean
  active: ScreenFilterId
  reason: string | null
}

export interface ControlState {
  // 现有字段省略
  screenFilter: ScreenFilterState
}

export type ControlCommand =
  // 现有命令省略
  { type: 'screen-filter'; filter: ScreenFilterId }
```

`ControlState` 是唯一 UI 状态源。Vue 不保存第二份“当前滤镜”。

## 6. 原生实现

新增 `packages/display-native/src/screen-filter.ts`，并只从 `native-worker.ts` 导入。

在 `packages/display-native/package.json` 增加对 `@screentools/display-core` 的 workspace 依赖；矩阵定义仍由 core 拥有，native 只负责调用 Win32。

### 6.1 Win32 绑定

通过 Koffi 加载 `Magnification.dll`：

```text
BOOL MagInitialize(void)
BOOL MagUninitialize(void)
BOOL MagGetFullscreenColorEffect(float[25])
BOOL MagSetFullscreenColorEffect(float[25])
```

状态生命周期：

1. 第一次使用时调用 `MagInitialize()`；
2. 紧接着用 `MagGetFullscreenColorEffect()` 保存 `baselineMatrix`；
3. 应用滤镜时调用 `MagSetFullscreenColorEffect(preset.matrix)`；
4. 关闭滤镜或 worker 退出时恢复 `baselineMatrix`；
5. 最后调用 `MagUninitialize()`。

`MagSetFullscreenColorEffect` 是全局覆盖型 API，多次调用时最后一次生效。因此首版不组合外部矩阵：若首次读取的矩阵不是 identity，返回“系统或其他程序正在使用颜色滤镜”，禁止启用 ScreenTools 滤镜，避免覆盖辅助功能。

比较矩阵时使用小误差，例如 `abs(a - b) <= 0.0001`。

### 6.2 原生接口

```ts
export interface NativeScreenFilterStatus {
  available: boolean
  active: ScreenFilterId
  reason: string | null
}

export function getScreenFilterStatus(): NativeScreenFilterStatus
export function applyScreenFilter(id: ScreenFilterId): NativeScreenFilterStatus
export function disposeScreenFilter(): void
```

规则：

- 只按白名单 ID 查找矩阵，worker 不接受渲染进程传入的原始矩阵；
- 每次设置后立即用 `MagGetFullscreenColorEffect()` 回读并比较；
- Win32 调用失败时附带 `GetLastError()` 数值，但不包含用户或设备路径；
- `disposeScreenFilter()` 必须可重复调用且不抛异常阻止进程退出。

### 6.3 worker 命令

在 `apps/desktop/src/main/native-worker.ts` 增加：

```ts
case 'screen-filter-status':
  result = getScreenFilterStatus()
  break
case 'screen-filter-apply':
  result = applyScreenFilter(message.payload as ScreenFilterId)
  break
```

在现有 `dispose` 和 `disconnect` 分支中，先调用 `disposeScreenFilter()`，再执行现有显示配置恢复和退出逻辑。

滤镜不是分辨率/拓扑变更，不放进 `change-transaction`。

## 7. 主进程实现

修改 `apps/desktop/src/main/services/control-service.ts`：

- 初始化 `state.screenFilter = { available: false, active: 'off', reason: null }`；
- `init()` 时请求一次 `screen-filter-status`；
- `execute()` 增加 `screen-filter` 分支；
- 校验 filter ID 后请求 `screen-filter-apply`；
- 只在 worker 返回成功后替换 `state.screenFilter`；
- 记录“屏幕滤镜已切换为：阅读/夜间/灰度/原色”；
- `dispose()` 仍通过现有 `native.dispose()` 触发 worker 恢复。

MVP 不把当前滤镜写入 `control.json`。每次启动都是“原色”，用户明确选择后才生效；正常退出应用会恢复原色。这能避免用户在 ScreenTools 未运行时被意外留在强滤镜状态。

如果 native worker 意外退出，现有 `NativeClient` 错误回调应把状态更新为不可用并显示提示。下次执行任何原生命令启动新 worker 后，应先请求 `screen-filter-status`，确认桌面矩阵没有残留再允许继续。

## 8. Renderer 实现

新增 `apps/desktop/src/renderer/src/components/tray/filters/ScreenFilters.vue`，由独立的 `ScreenFiltersPage.vue` 引入。

组件职责：

- props 接收 `state` 和 `locked`；
- 使用静态 preset 元数据渲染四个按钮；
- 使用 `computed` 推导禁用文案；
- 点击后调用 `controls.execute({ type: 'screen-filter', filter: id })`；
- 不保存本地 active 状态，不 watch 后触发副作用。

组件内只保留 `{ id, label }` 的展示选项，颜色矩阵不会进入 renderer。组件采用 `<script setup lang="ts">`，模板使用稳定 `:key="filter.id"`，按钮带 `aria-pressed`。

## 9. 文件改动清单

| 文件                                                                        | 改动                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/display-core/src/screen-filters.ts`                               | ID、矩阵与 preset 纯数据                               |
| `packages/display-core/src/index.ts`                                        | 导出滤镜定义                                           |
| `packages/contracts/src/control.ts`                                         | 状态与命令契约                                         |
| `packages/display-native/package.json`                                      | 增加 display-core workspace 依赖                       |
| `packages/display-native/src/screen-filter.ts`                              | Magnification API 封装                                 |
| `apps/desktop/src/main/native-worker.ts`                                    | 应用、查询和退出恢复                                   |
| `apps/desktop/src/main/services/control-service.ts`                         | 命令编排与状态                                         |
| `apps/desktop/src/renderer/src/components/tray/filters/ScreenFilters.vue`   | 滤镜卡片                                               |
| `apps/desktop/src/renderer/src/components/tray/pages/ScreenFiltersPage.vue` | 独立滤镜 Tab 页面                                      |
| `apps/desktop/src/renderer/src/components/tray/TrayPanel.vue`               | 注册第四个 Tab                                         |
| 对应 `*.test.ts`                                                            | 矩阵、服务、恢复测试及现有 `ControlState` fixture 更新 |

无需新增 preload API、透明窗口、系统级权限或第三方依赖。

## 10. 测试与验收

自动化测试至少覆盖：

- preset ID 唯一且每个矩阵恰好 25 个有限数字；
- 未知 filter ID 被拒绝；
- 应用成功后 `ControlState.screenFilter.active` 更新；
- 原生失败时 active 保持原值；
- `off` 恢复 baseline，而不是盲目写 identity；
- `disposeScreenFilter()` 重复调用安全；
- 检测到非 identity 外部矩阵时拒绝覆盖；
- worker 的 `dispose` 和 `disconnect` 都调用恢复。

实机验收：

1. Windows 10/11 SDR 桌面依次切换阅读、夜间、灰度和原色；
2. 双屏环境确认所有显示器同时变化，UI 明确显示“所有显示器”；
3. 正常退出应用后恢复启用前颜色；
4. 开启 Windows 放大镜或系统颜色滤镜后，ScreenTools 不覆盖它；
5. HDR、独占全屏游戏、受保护视频和远程桌面分别记录实际行为；
6. API 失败时，现有亮度、HDR、分辨率等功能仍正常。

最终运行：

```bash
pnpm check
```

验收标准：用户可以在托盘面板中一键切换预设；效果立即作用于整个桌面；应用正常退出时可靠恢复；失败不会留下错误的 UI 选中状态，也不会破坏现有显示控制。

## 11. 后续扩展

确认 MVP 稳定后再考虑：

- 强度滑块：用 `identity + (preset - identity) * strength` 生成矩阵；
- 用户自定义：只暴露色温、亮度、饱和度等受限参数，再由纯函数生成安全矩阵；
- 定时切换和快捷键；
- 是否随应用启动重新应用上次滤镜；
- 若需要真正的模糊、锐化、颗粒等像素邻域效果，需另行评估桌面捕获与 GPU shader，颜色矩阵无法实现。

## 12. API 依据

- [MagSetFullscreenColorEffect](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetfullscreencoloreffect)：使用 5×5 矩阵改变整个桌面的颜色效果，Windows 8 起可用。
- [MagGetFullscreenColorEffect](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-maggetfullscreencoloreffect)：读取当前全屏颜色矩阵，用于保存和校验恢复状态。
- [MAGCOLOREFFECT](https://learn.microsoft.com/en-us/windows/win32/api/magnification/ns-magnification-magcoloreffect)：颜色矩阵结构定义。
