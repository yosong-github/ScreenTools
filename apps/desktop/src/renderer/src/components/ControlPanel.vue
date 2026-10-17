<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type {
  AppSettings,
  ChangePlan,
  DisplaySetting,
  HardwareFeature,
  HardwareValue,
} from '@screentools/contracts'
import { defaultSettings } from '@screentools/contracts'
import { useControlsStore } from '@renderer/stores/controls'
const store = useControlsStore()
const { state, busy, error } = storeToRefs(store)
const selectedId = ref('')
const draft = ref<DisplaySetting[]>([])
const settings = ref<AppSettings>({ ...defaultSettings, aliases: {} })
const profileId = ref('')
const profileName = ref('')
const profileTopology = ref<NonNullable<ChangePlan['topology']> | ''>('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const selected = computed(() => state.value?.devices.find((d) => d.id === selectedId.value))
const editing = computed(() => draft.value.find((d) => d.id === selectedId.value))
const capabilities = computed(() => state.value?.capabilities[selectedId.value] ?? {})
const locked = computed(() => busy.value || !!state.value?.pending)
const countdown = computed(() =>
  Math.max(0, Math.ceil(((state.value?.pending?.expiresAt ?? now.value) - now.value) / 1000)),
)
const names: Record<HardwareFeature, string> = {
  brightness: '亮度',
  contrast: '对比度',
  volume: '音量',
  inputSource: '输入源',
  power: '电源',
}
const topologyNames = {
  extend: '扩展',
  clone: '复制',
  internal: '仅电脑屏幕',
  external: '仅外接屏幕',
} as const
function resetDraft(): void {
  draft.value = (state.value?.devices ?? []).map((d) => ({
    id: d.id,
    mode: { ...d.mode },
    x: d.x,
    y: d.y,
    rotation: d.rotation,
    primary: d.primary,
    ...(d.hdr?.supported ? { hdrEnabled: d.hdr.enabled } : {}),
  }))
}
watch(
  () => state.value?.devices,
  () => {
    if (!state.value?.devices.some((d) => d.id === selectedId.value))
      selectedId.value = state.value?.devices[0]?.id ?? ''
  },
  { immediate: true },
)
// 仅在设备配置真实改变时同步草稿，日志或能力更新不会覆盖正在编辑的内容。
watch(() => JSON.stringify(state.value?.devices), resetDraft, { immediate: true })
watch(
  () => JSON.stringify(state.value?.settings),
  () => {
    if (state.value) settings.value = structuredClone(state.value.settings)
  },
  { immediate: true },
)
watch(profileId, (id) => {
  profileName.value = state.value?.profiles.find((p) => p.id === id)?.name ?? ''
})
function primary(): void {
  for (const d of draft.value) d.primary = d.id === selectedId.value
}
function rotate(event: Event): void {
  if (!editing.value) return
  const rotation = Number((event.target as HTMLSelectElement).value) as DisplaySetting['rotation']
  if (rotation % 180 !== editing.value.rotation % 180)
    [editing.value.mode.width, editing.value.mode.height] = [
      editing.value.mode.height,
      editing.value.mode.width,
    ]
  editing.value.rotation = rotation
}
function mode(event: Event): void {
  const choice = selected.value?.modes[Number((event.target as HTMLSelectElement).value)]
  if (!choice || !editing.value || !selected.value) return
  const swap = editing.value.rotation % 180 !== selected.value.rotation % 180
  editing.value.mode = {
    ...choice,
    width: swap ? choice.height : choice.width,
    height: swap ? choice.width : choice.height,
  }
}
function percent(value: HardwareValue): number {
  return value.max > value.min
    ? Math.round(((value.current - value.min) / (value.max - value.min)) * 100)
    : 0
}
async function linkedBrightness(event: Event): Promise<void> {
  const value = Number((event.target as HTMLInputElement).value)
  const hardware = Object.entries(state.value?.capabilities ?? {})
    .filter(([, caps]) => caps.brightness)
    .map(([id]) => ({ id, feature: 'brightness' as const, value }))
  if (hardware.length) await store.execute({ type: 'apply', plan: { displays: [], hardware } })
}
async function hardware(feature: HardwareFeature, value: number): Promise<void> {
  if (
    (feature === 'inputSource' || feature === 'power') &&
    !window.confirm('该操作可能使屏幕断开，无法自动恢复。请确认你能通过显示器实体按键恢复。')
  )
    return
  await store.execute({ type: 'hardware', setting: { id: selectedId.value, feature, value } })
}
function saveProfile(): void {
  const hardware = Object.entries(state.value?.capabilities ?? {}).flatMap(([id, caps]) =>
    (['brightness', 'contrast', 'volume'] as const).flatMap((feature) =>
      caps[feature] ? [{ id, feature, value: percent(caps[feature]) }] : [],
    ),
  )
  void store.execute({
    type: 'save-profile',
    profile: {
      id: profileId.value || crypto.randomUUID(),
      name: profileName.value,
      plan: {
        ...(profileTopology.value ? { topology: profileTopology.value } : {}),
        displays: profileTopology.value
          ? []
          : (JSON.parse(JSON.stringify(draft.value)) as DisplaySetting[]),
        hardware,
      },
    },
  })
}
function applyDraft(): void {
  void store.execute({
    type: 'apply',
    plan: { displays: JSON.parse(JSON.stringify(draft.value)) as DisplaySetting[], hardware: [] },
  })
}
async function deleteProfile(): Promise<void> {
  if (await store.execute({ type: 'delete-profile', id: profileId.value })) profileId.value = ''
}
function align(): void {
  let x = 0
  for (const d of draft.value) {
    d.x = x
    d.y = 0
    x += d.mode.width
  }
}
const bounds = computed(() => {
  const all = draft.value
  const x = Math.min(0, ...all.map((d) => d.x)),
    y = Math.min(0, ...all.map((d) => d.y))
  return {
    x: x - 100,
    y: y - 100,
    width: Math.max(1, ...all.map((d) => d.x + d.mode.width)) - x + 200,
    height: Math.max(1, ...all.map((d) => d.y + d.mode.height)) - y + 200,
  }
})
let drag: {
  id: string
  x: number
  y: number
  startX: number
  startY: number
  ratio: number
} | null = null
function beginDrag(event: PointerEvent, d: DisplaySetting): void {
  if (locked.value) return
  selectedId.value = d.id
  const svg = event.currentTarget as SVGSVGElement
  const matrix = svg.getScreenCTM()
  if (!matrix) return
  svg.setPointerCapture(event.pointerId)
  drag = { id: d.id, x: event.clientX, y: event.clientY, startX: d.x, startY: d.y, ratio: matrix.a }
}
function move(event: PointerEvent): void {
  if (!drag) return
  const d = draft.value.find((d) => d.id === drag?.id)
  if (!d) return
  d.x = Math.round(drag.startX + (event.clientX - drag.x) / drag.ratio)
  d.y = Math.round(drag.startY + (event.clientY - drag.y) / drag.ratio)
}
onMounted(() => {
  store.start()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 250)
})
onUnmounted(() => {
  store.stop()
  clearInterval(timer)
})
</script>

<template>
  <section class="panel control-panel">
    <div class="section-heading">
      <h2>系统与硬件控制</h2>
      <button :disabled="locked" @click="store.execute({ type: 'refresh' })">重新枚举</button>
    </div>
    <p v-if="error || state?.error" class="error" role="alert">{{ error || state?.error }}</p>
    <p v-if="!state?.devices.length" class="hint">
      正在连接 Windows 原生控制服务；仅支持 Windows x64。
    </p>
    <template v-if="state?.devices.length">
      <div class="control-actions">
        <button
          v-for="(name, topology) in topologyNames"
          :key="topology"
          :disabled="locked"
          @click="store.execute({ type: 'apply', plan: { topology, displays: [], hardware: [] } })"
        >
          {{ name }}
        </button>
      </div>
      <p class="hint">
        模式和拓扑变更需在 20 秒内确认。拖动布局或编辑坐标后，点击「应用布局与模式」。
      </p>
      <svg
        class="editable-layout"
        :viewBox="`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`"
        aria-label="拖动显示器调整布局"
        @pointermove="move"
        @pointerup="drag = null"
        @pointercancel="drag = null"
      >
        <g v-for="(d, index) in draft" :key="d.id" @pointerdown="beginDrag($event, d)">
          <rect
            :x="d.x"
            :y="d.y"
            :width="d.mode.width"
            :height="d.mode.height"
            :class="{ chosen: d.id === selectedId }"
          />
          <text
            :x="d.x + d.mode.width / 2"
            :y="d.y + d.mode.height / 2"
            :font-size="Math.min(d.mode.width, d.mode.height) / 5"
            text-anchor="middle"
          >
            {{ index + 1 }}{{ d.primary ? ' ★' : '' }}
          </text>
        </g>
      </svg>
      <div class="control-actions">
        <button :disabled="locked" @click="align">横向排列</button
        ><button :disabled="locked" @click="resetDraft">撤销草稿</button
        ><button :disabled="locked" @click="applyDraft">应用布局与模式</button>
      </div>
      <label
        >显示器<select v-model="selectedId">
          <option v-for="d in state.devices" :key="d.id" :value="d.id">
            {{ settings.aliases[d.id] || d.name }} · {{ d.connection }}
          </option>
        </select></label
      >
      <fieldset v-if="editing && selected" :disabled="locked">
        <div class="control-fields">
          <label
            >设备别名<input
              v-model="settings.aliases[selectedId]"
              maxlength="60"
              placeholder="例如：左侧工作屏"
          /></label>
          <label
            >模式<select @change="mode">
              <option value="">
                当前 {{ editing.mode.width }} × {{ editing.mode.height }} ·
                {{ editing.mode.refreshRate.toFixed(2) }} Hz
              </option>
              <option v-for="(m, i) in selected.modes" :key="i" :value="i">
                {{ m.width }} × {{ m.height }} · {{ m.refreshRate }} Hz
              </option>
            </select></label
          >
          <label
            >方向<select :value="editing.rotation" @change="rotate">
              <option v-for="r in [0, 90, 180, 270]" :key="r" :value="r">{{ r }}°</option>
            </select></label
          >
          <label
            >X 坐标<input v-model.number="editing.x" type="number" min="-65536" max="65536"
          /></label>
          <label
            >Y 坐标<input v-model.number="editing.y" type="number" min="-65536" max="65536"
          /></label>
        </div>
        <label v-if="selected.hdr?.supported"
          ><input v-model="editing.hdrEnabled" type="checkbox" />启用 HDR / 高级颜色</label
        >
        <button :disabled="editing.primary" @click="primary">
          {{ editing.primary ? '当前主屏' : '设为主屏（应用后生效）' }}
        </button>
        <p class="hint">设备标识 {{ selected.id }} · 别名与下方应用设置一起保存。</p>
        <hr />
        <label v-if="Object.values(state.capabilities).filter((c) => c.brightness).length > 1"
          >联动所有已探测显示器的亮度<input
            type="range"
            min="0"
            max="100"
            @change="linkedBrightness"
        /></label>
        <div class="section-heading">
          <h3>DDC/CI 硬件能力</h3>
          <button @click="store.execute({ type: 'probe', id: selectedId })">探测 / 重新读取</button>
        </div>
        <p class="hint">
          先在显示器菜单开启 DDC/CI；不支持的功能不会显示。释放滑块时才提交，设备响应可能需数秒。
        </p>
        <p v-if="state.capabilities[selectedId] && !Object.keys(capabilities).length">
          未发现可控能力，或切换后设备已不可达。
        </p>
        <template v-for="(value, feature) in capabilities" :key="feature">
          <label
            v-if="
              value && (feature === 'brightness' || feature === 'contrast' || feature === 'volume')
            "
            >{{ names[feature] }} {{ percent(value) }}%<input
              :value="percent(value)"
              type="range"
              min="0"
              max="100"
              @change="hardware(feature, Number(($event.target as HTMLInputElement).value))"
          /></label>
          <label v-else-if="value?.values"
            >{{ names[feature] }}（实验性）<select
              :value="value.current"
              @change="hardware(feature, Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="v in value.values" :key="v" :value="v">
                VCP 0x{{ v.toString(16).toUpperCase() }}{{ v === value.current ? ' · 当前' : '' }}
              </option>
            </select></label
          >
        </template>
        <button v-if="capabilities.volume" @click="hardware('volume', 0)">静音（音量归零）</button>
      </fieldset>
    </template>
  </section>
  <section v-if="state" class="panel control-panel">
    <h2>配置方案</h2>
    <fieldset :disabled="locked">
      <div class="control-fields">
        <label
          >已有方案<select v-model="profileId">
            <option value="">新建方案</option>
            <option v-for="p in state.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select></label
        ><label>方案名称<input v-model="profileName" maxlength="60" /></label
        ><label
          >保存内容<select v-model="profileTopology">
            <option value="">当前编辑布局 + 已读取硬件值</option>
            <option v-for="(name, key) in topologyNames" :key="key" :value="key">
              {{ name }}拓扑 + 已读取硬件值
            </option>
          </select></label
        >
      </div>
      <p class="hint">
        仅保存已探测的亮度、对比度和音量；输入源、电源需手动确认，避免自动方案断开屏幕。
      </p>
      <div class="control-actions">
        <button :disabled="!profileName.trim()" @click="saveProfile">
          {{ profileId ? '用当前草稿更新方案' : '保存方案' }}</button
        ><button
          :disabled="!profileId"
          @click="store.execute({ type: 'apply-profile', id: profileId })"
        >
          应用方案</button
        ><button :disabled="!profileId" @click="deleteProfile">删除方案</button
        ><button @click="store.execute({ type: 'import-profiles' })">导入</button
        ><button @click="store.execute({ type: 'export-profiles' })">导出</button>
      </div>
    </fieldset>
    <h2>应用设置</h2>
    <fieldset :disabled="locked">
      <label><input v-model="settings.closeToTray" type="checkbox" />关闭窗口时隐藏到托盘</label
      ><label><input v-model="settings.launchAtLogin" type="checkbox" />登录时启动（安装版）</label>
      <div class="control-fields">
        <label
          >打开面板快捷键<input
            v-model="settings.shortcut"
            placeholder="CommandOrControl+Alt+D" /></label
        ><label
          >启动时应用<select v-model="settings.startupProfileId">
            <option :value="null">不自动应用</option>
            <option v-for="p in state.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select></label
        ><label
          >设备接入 / 断开时应用<select v-model="settings.connectProfileId">
            <option :value="null">不自动应用</option>
            <option v-for="p in state.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select></label
        >
      </div>
      <button
        @click="store.execute({ type: 'settings', settings: JSON.parse(JSON.stringify(settings)) })"
      >
        保存应用设置与别名
      </button>
    </fieldset>
    <details>
      <summary>诊断与操作记录</summary>
      <button :disabled="busy" @click="store.execute({ type: 'copy-diagnostics' })">
        复制脱敏报告
      </button>
      <button :disabled="busy" @click="store.execute({ type: 'export-diagnostics' })">
        导出脱敏诊断报告
      </button>
      <ul class="operation-log">
        <li v-for="(log, index) in [...state.logs].reverse()" :key="index">
          {{ new Date(log.time).toLocaleTimeString() }} · {{ log.message }}
        </li>
      </ul>
    </details>
  </section>
  <div
    v-if="state?.pending"
    class="confirm-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
  >
    <section class="panel">
      <h2 id="confirm-title">保留新的显示配置？</h2>
      <p>{{ countdown }} 秒后自动恢复。若画面异常，请等待恢复或点击立即恢复。</p>
      <div class="control-actions">
        <button
          :disabled="busy || countdown === 0"
          @click="store.execute({ type: 'confirm', token: state.pending.token })"
        >
          保留配置</button
        ><button
          :disabled="busy"
          @click="store.execute({ type: 'revert', token: state.pending.token })"
        >
          立即恢复
        </button>
      </div>
    </section>
  </div>
</template>
