<script setup lang="ts">
import { computed, onActivated, onDeactivated, shallowRef, watch } from 'vue'
import type {
  EnhanceCrop,
  EnhancePreset,
  EnhanceWindow,
  EnhanceWindowSnapshot,
} from '@screentools/contracts'
import ChoiceButton from '@renderer/components/ChoiceButton.vue'
import PanelIcon from '@renderer/components/PanelIcon.vue'
import { useEnhanceStore } from '@renderer/stores/enhance'

defineOptions({ name: 'EnhanceView' })

const enhance = useEnhanceStore()
const mode = shallowRef<'window' | 'video'>('window')
const selectedHwnd = shallowRef<number | null>(null)
const cropLoading = shallowRef(false)
const cropError = shallowRef('')
const cropDialog = shallowRef<{ hwnd: number; snapshot: EnhanceWindowSnapshot } | null>(null)
const cropSelection = shallowRef<{
  left: number
  top: number
  width: number
  height: number
} | null>(null)
const cropImage = shallowRef<HTMLImageElement | null>(null)
let cropStart: { x: number; y: number } | null = null
const presets: Array<{ value: EnhancePreset; label: string; hint: string }> = [
  { value: 'auto', label: '自动', hint: '24fps → 900p/48fps，30fps → 720p/60fps，≥40fps 关闭。' },
  { value: 'quality', label: '质量', hint: '固定 900p 处理；24fps → 48fps，30fps → 60fps。' },
  {
    value: 'anime',
    label: '2K AI',
    hint: '24fps → 900p/48fps，30fps → 720p/60fps，modernAnime 放大到 2K；动画/CG 优化。',
  },
  {
    value: 'tensorrt',
    label: 'TRT 1080p',
    hint: '1080p 原生 TensorRT 插帧 + modernAnime 2K；首次构建引擎约 2–3 分钟。',
  },
  { value: 'balanced', label: '均衡', hint: '固定 720p 处理；24fps → 48fps，30fps → 60fps。' },
  { value: 'performance', label: '性能', hint: '固定 540p 处理；适合较弱 GPU 或高刷新输出。' },
  { value: 'off', label: '关闭', hint: '不插帧，仅使用高质量缩放播放。' },
]
const component = computed(() => enhance.state?.component ?? null)
const playback = computed(() => enhance.state?.playback ?? null)
const fileLabel = computed(() => {
  if (!playback.value) return ''
  return playback.value.title || playback.value.file.split(/[\\/]/).pop() || playback.value.file
})
const fpsText = computed(() => {
  if (!playback.value) return ''
  const source = playback.value.sourceFps
  const output = playback.value.outputFps
  return `${source ? source.toFixed(0) : '—'} → ${output ? output.toFixed(0) : '—'} fps`
})
const positionText = computed(() => {
  if (!playback.value) return ''
  const position = playback.value.position
  const duration = playback.value.duration
  if (position === null || duration === null) return ''
  return `${formatTime(position)} / ${formatTime(duration)}`
})
const activeHint = computed(
  () => presets.find((preset) => preset.value === enhance.preset)?.hint ?? presets[0]!.hint,
)
const selectedWindow = computed(
  () => enhance.windows.find((window) => window.hwnd === selectedHwnd.value) ?? null,
)
const windowLabel = computed(() => {
  const capture = enhance.state?.windowCapture
  return capture?.active ? `${capture.process} · ${capture.title}` : ''
})
const selectedCrop = computed<EnhanceCrop | null>(() => {
  const hwnd = selectedHwnd.value
  return hwnd ? (enhance.crops[hwnd] ?? null) : null
})
const cropSizeText = computed(() => {
  const selection = cropSelection.value
  const snapshot = cropDialog.value?.snapshot
  const image = cropImage.value
  if (!selection || !snapshot || !image) return ''
  const rect = image.getBoundingClientRect()
  if (!rect.width || !rect.height) return ''
  const width = Math.round((selection.width / rect.width) * snapshot.width)
  const height = Math.round((selection.height / rect.height) * snapshot.height)
  return `${width} × ${height}`
})
watch(
  () => enhance.windows,
  (windows) => {
    if (windows.some((window) => window.hwnd === selectedHwnd.value)) return
    selectedHwnd.value =
      windows.find((window) => /哔哩|bilibili/i.test(`${window.process} ${window.title}`))?.hwnd ??
      windows[0]?.hwnd ??
      null
  },
  { immediate: true },
)
async function startWindowCapture(): Promise<void> {
  const target = selectedWindow.value
  if (target && !enhance.windowActive) await enhance.startWindow(target)
}
async function openCropDialog(): Promise<void> {
  const target = selectedWindow.value
  if (!target || enhance.windowActive || cropLoading.value) return
  cropError.value = ''
  cropLoading.value = true
  try {
    const snapshot = await enhance.captureSnapshot(target.hwnd)
    if (!snapshot) {
      cropError.value = '读取窗口截图失败，请先把目标窗口恢复为可见状态再试。'
      return
    }
    cropDialog.value = { hwnd: target.hwnd, snapshot }
    cropSelection.value = null
    cropStart = null
  } finally {
    cropLoading.value = false
  }
}
function closeCropDialog(): void {
  cropDialog.value = null
  cropSelection.value = null
  cropStart = null
}
function cropPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !cropImage.value) return
  const rect = cropImage.value.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  cropStart = { x, y }
  cropSelection.value = { left: x, top: y, width: 0, height: 0 }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function cropPointerMove(event: PointerEvent): void {
  if (!cropStart || !cropImage.value) return
  const rect = cropImage.value.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  cropSelection.value = {
    left: Math.min(cropStart.x, x),
    top: Math.min(cropStart.y, y),
    width: Math.abs(x - cropStart.x),
    height: Math.abs(y - cropStart.y),
  }
}
function cropPointerUp(event: PointerEvent): void {
  if (!cropStart) return
  cropStart = null
  const selection = cropSelection.value
  if (selection && (selection.width < 8 || selection.height < 8)) cropSelection.value = null
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId))
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}
function applyCrop(): void {
  const dialog = cropDialog.value
  const image = cropImage.value
  const selection = cropSelection.value
  if (!dialog || !image || !selection) return
  const rect = image.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const scaleX = dialog.snapshot.width / rect.width
  const scaleY = dialog.snapshot.height / rect.height
  const crop: EnhanceCrop = {
    x: Math.round(selection.left * scaleX),
    y: Math.round(selection.top * scaleY),
    width: Math.round(selection.width * scaleX),
    height: Math.round(selection.height * scaleY),
  }
  if (crop.width < 16 || crop.height < 16) {
    cropError.value = '框选区域太小，请重新拖拽。'
    return
  }
  enhance.setCrop(dialog.hwnd, crop)
  cropError.value = ''
  closeCropDialog()
}
function clearSelectedCrop(): void {
  const hwnd = selectedHwnd.value
  if (hwnd) enhance.clearCrop(hwnd)
}
function cropBoxStyle(selection: {
  left: number
  top: number
  width: number
  height: number
}): Record<string, string> {
  return {
    left: `${selection.left}px`,
    top: `${selection.top}px`,
    width: `${selection.width}px`,
    height: `${selection.height}px`,
  }
}
function windowOptionLabel(window: EnhanceWindow): string {
  return `${window.process} · ${window.title}`
}
const componentText = computed(() => {
  if (!component.value) return '正在检测增强组件…'
  if (component.value.available)
    return component.value.version
      ? `mpv + VapourSynth + RIFE · ${component.value.version}`
      : 'mpv + VapourSynth + RIFE'
  return component.value.error ?? '增强组件不可用'
})

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

onActivated(() => {
  enhance.start()
  if (!enhance.windowActive) void enhance.refreshWindows()
})
onDeactivated(() => {
  enhance.stop()
  closeCropDialog()
})
</script>

<template>
  <section class="page-view overflow-y-auto overscroll-contain pr-[2px]">
    <div class="section-caption"><span>画质增强</span><span>本机 GPU 实时处理</span></div>
    <div class="choice-grid grid-cols-2" role="group" aria-label="增强方式">
      <ChoiceButton :pressed="mode === 'window'" @click="mode = 'window'"> 窗口增强 </ChoiceButton>
      <ChoiceButton :pressed="mode === 'video'" @click="mode = 'video'"> 本地视频 </ChoiceButton>
    </div>

    <template v-if="mode === 'video'">
      <div class="card compact-card">
        <div class="card-title">
          <PanelIcon name="sparkles" />
          <strong>增强组件</strong>
          <span>{{ enhance.available ? '已就绪' : '未安装' }}</span>
        </div>
        <p class="card-note break-all" :title="component?.directory ?? ''">{{ componentText }}</p>
        <p v-if="enhance.available" class="card-note">
          {{
            component?.tensorrt ? 'TensorRT 已就绪（1080p 原生）' : 'TensorRT 未安装，仅 DirectML'
          }}
        </p>
        <div class="button-row mt-[10px]">
          <button class="dialog-button" @click="enhance.chooseComponent()">
            <PanelIcon :name="enhance.available ? 'refresh' : 'plus'" :size="14" />
            {{ enhance.available ? '更换组件目录' : '选择组件目录' }}
          </button>
        </div>
      </div>

      <div class="section-caption"><span>插帧与超分</span><span>按输入帧率自动选择</span></div>
      <div class="card compact-card">
        <div class="card-title">
          <PanelIcon name="gauge" />
          <strong>预设</strong>
          <span>{{ enhance.preset === 'off' ? '仅缩放' : 'RIFE 2×' }}</span>
        </div>
        <div class="choice-grid grid-cols-4" role="group" aria-label="插帧预设">
          <ChoiceButton
            v-for="preset in presets"
            :key="preset.value"
            :disabled="!enhance.available || (preset.value === 'tensorrt' && !component?.tensorrt)"
            :pressed="enhance.preset === preset.value"
            @click="enhance.setPreset(preset.value)"
          >
            {{ preset.label }}
          </ChoiceButton>
        </div>
        <p class="card-note">{{ activeHint }}</p>
        <p class="card-note">
          超分：2K AI / TRT 1080p 用 modernAnime（动画/CG），自动/质量用 Lanczos，均衡/性能用
          FSRCNNX。
        </p>
      </div>

      <div class="section-caption">
        <span>播放</span><span>{{ enhance.playing ? '正在播放' : '未播放' }}</span>
      </div>
      <div class="card compact-card">
        <div class="card-title">
          <PanelIcon name="film" />
          <strong class="truncate">{{ playback ? fileLabel : '增强播放' }}</strong>
          <span v-if="playback">{{ fpsText }}</span>
        </div>
        <template v-if="playback">
          <p class="card-note break-all">{{ playback.title }}</p>
          <div class="flex items-center justify-between gap-2 mt-[9px] text-[11px] text-muted">
            <span>丢帧 {{ playback.droppedFrames }}</span>
            <span>{{ positionText }}</span>
          </div>
          <div class="button-row mt-[10px]">
            <button class="dialog-button" @click="enhance.stopPlayback()">
              <PanelIcon name="power" :size="14" />停止播放
            </button>
          </div>
        </template>
        <template v-else>
          <p class="card-note">
            打开本地视频，在独立的 mpv 窗口播放；首次加载模型可能需要 3–8 秒。
          </p>
          <p v-if="enhance.preset === 'tensorrt'" class="card-note">
            TensorRT 首次播放需构建引擎，窗口可能黑屏 2–3 分钟；之后走缓存。
          </p>
          <div class="button-row mt-[10px]">
            <button
              class="primary-action"
              :disabled="!enhance.available"
              @click="enhance.openVideo()"
            >
              <PanelIcon name="film" :size="14" />打开视频
            </button>
          </div>
        </template>
      </div>
    </template>

    <template v-else>
      <div class="section-caption"><span>窗口增强</span><span>WGC 捕获</span></div>
      <div class="card compact-card">
        <div class="card-title">
          <PanelIcon name="layout" />
          <strong>选择应用窗口</strong>
          <span>{{
            enhance.windowActive
              ? enhance.windowPaused
                ? '原画面'
                : '增强中'
              : `${enhance.windows.length} 个窗口`
          }}</span>
        </div>
        <select
          v-model="selectedHwnd"
          class="window-picker"
          :disabled="enhance.windowLoading || enhance.windowActive"
          aria-label="选择要增强的窗口"
        >
          <option :value="null" disabled>选择窗口…</option>
          <option v-for="window in enhance.windows" :key="window.hwnd" :value="window.hwnd">
            {{ windowOptionLabel(window) }}
          </option>
        </select>
        <div class="button-row mt-[10px]">
          <template v-if="!enhance.windowActive">
            <button
              class="dialog-button"
              :disabled="enhance.windowLoading"
              @click="enhance.refreshWindows()"
            >
              <PanelIcon name="refresh" :size="14" />
              {{ enhance.windowLoading ? '读取中…' : '刷新窗口' }}
            </button>
            <button
              class="dialog-button"
              :disabled="!selectedWindow || cropLoading"
              @click="openCropDialog"
            >
              <PanelIcon name="layout" :size="14" />
              {{ cropLoading ? '读取中…' : selectedCrop ? '重新框选' : '框选视频区域' }}
            </button>
          </template>
          <template v-else>
            <button class="dialog-button" @click="enhance.toggleWindow()">
              <PanelIcon :name="enhance.windowPaused ? 'refresh' : 'layout'" :size="14" />
              {{ enhance.windowPaused ? '恢复增强' : '对比原画面' }}
            </button>
            <button class="dialog-button" @click="enhance.stopWindow()">
              <PanelIcon name="power" :size="14" />停止增强
            </button>
          </template>
        </div>
        <button
          v-if="!enhance.windowActive"
          class="primary-action w-full mt-[8px]"
          :disabled="!selectedWindow || enhance.windowLoading"
          @click="startWindowCapture"
        >
          <PanelIcon name="sparkles" :size="14" />
          {{ selectedCrop ? '开始增强（视频区域）' : '开始增强（完整窗口）' }}
        </button>
        <p v-if="selectedCrop" class="card-note">
          已框选视频区域 {{ selectedCrop.width }}×{{
            selectedCrop.height
          }}：只把这一块放大到全屏，视频本身不裁切。
          <button class="inline-clear" @click="clearSelectedCrop">清除</button>
        </p>
        <p v-if="cropError" class="enhance-error">{{ cropError }}</p>
        <p v-if="enhance.windowActive" class="card-note">
          {{ enhance.windowPaused ? '当前显示原画面：' : '正在增强：' }}{{ windowLabel }}
        </p>
        <p v-else-if="!selectedCrop" class="card-note">
          选择 B 站/播放器窗口后开始；想只显示视频画面，点「框选视频区域」。
        </p>
        <p v-if="enhance.windowActive" class="card-note">
          按 <strong>Ctrl+Alt+G</strong> 快速切换「增强 / 原画面」，直接对比效果；按
          <strong>Ctrl+Alt+Shift+E</strong> 停止。
        </p>
        <p class="card-note">
          当前窗口增强使用 FSR 1.0 EASU + RCAS 做空间超分和锐化；比纯缩放清晰，但不等同于 AI
          补细节。
        </p>
        <p class="card-note">
          鼠标移动/点击/滚轮会按缩放比例转发到原窗口；先在画面上单击一下，键盘输入会回到原窗口。
        </p>
        <p class="card-note">
          少数使用 Raw Input
          的程序（部分游戏）可能不响应转发；视频播放器/浏览器通常可用。覆盖层会盖住本面板，停止请用热键。
        </p>
        <p v-if="enhance.state?.windowCapture.error" class="enhance-error">
          {{ enhance.state.windowCapture.error }}
        </p>
      </div>
    </template>

    <p v-if="enhance.state?.error" class="enhance-error">{{ enhance.state.error }}</p>
    <p v-if="mode === 'video'" class="settings-description">
      受 DRM 保护的视频无法增强；24fps 电影在快速运动处可能有瑕疵。播放窗口内按 F 全屏，Esc 退出。
    </p>
    <p v-else class="settings-description">
      B 站等客户端的 DRM 内容可能黑屏；捕获的是窗口最终画面，若应用已经放大到 4K，超分收益会变小。
    </p>

    <Teleport to="body">
      <div v-if="cropDialog" class="crop-backdrop" @click.self="closeCropDialog">
        <div class="crop-dialog">
          <div class="crop-dialog-title">框选视频区域</div>
          <p class="crop-dialog-note">
            在截图上拖出视频画面，尽量不要包含标题栏、侧边栏或黑边。之后只把这一块放大到全屏，视频本身不会被裁切。
          </p>
          <div
            class="crop-stage"
            @pointerdown="cropPointerDown"
            @pointermove="cropPointerMove"
            @pointerup="cropPointerUp"
            @pointercancel="cropPointerUp"
          >
            <img
              ref="cropImage"
              :src="cropDialog.snapshot.dataUrl"
              alt="窗口截图"
              draggable="false"
            />
            <div v-if="cropSelection" class="crop-box" :style="cropBoxStyle(cropSelection)"></div>
            <div v-else class="crop-hint">拖动框选视频画面</div>
          </div>
          <div class="crop-dialog-footer">
            <span class="crop-size">
              {{ cropSelection ? `区域 ${cropSizeText} 像素` : '尚未选择区域' }}
            </span>
            <div class="crop-actions">
              <button class="dialog-button" @click="closeCropDialog">取消</button>
              <button class="primary-action" :disabled="!cropSelection" @click="applyCrop">
                使用此区域
              </button>
            </div>
          </div>
          <p v-if="cropError" class="enhance-error">{{ cropError }}</p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
