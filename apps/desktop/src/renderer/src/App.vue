<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { screenTools } from '@renderer/api/screen-tools'
import { useDisplaysStore } from '@renderer/stores/displays'
import DisplayLayout from '@renderer/components/DisplayLayout.vue'
import DisplayDetails from '@renderer/components/DisplayDetails.vue'
import ControlPanel from '@renderer/components/ControlPanel.vue'
const store = useDisplaysStore()
const { snapshot, displays, selected, selectedId, loading, error } = storeToRefs(store)
onMounted(store.start)
onUnmounted(store.stop)
</script>
<template>
  <main class="app-shell">
    <header class="page-heading">
      <div>
        <p class="brand">SCREENTOOLS <span>设备中心</span></p>
        <h1>你的桌面，一目了然。</h1>
        <p class="subtitle">查看当前显示器与桌面布局，自动同步系统变化。</p>
      </div>
      <button class="refresh" :disabled="loading" @click="store.refresh()">
        {{ loading ? '正在读取…' : '刷新设备' }}
      </button>
    </header>
    <div v-if="error" class="error" role="alert">
      {{ error }} <button :disabled="loading" @click="store.refresh()">重试</button>
    </div>
    <div class="summary" aria-live="polite">
      <span class="status-dot"></span>{{ displays.length }} 台活动显示器<span v-if="snapshot"
        >上次同步 {{ new Date(snapshot.capturedAt).toLocaleTimeString() }}</span
      ><span v-if="error">状态待确认</span>
    </div>
    <section v-if="!snapshot && loading" class="panel empty" role="status">
      正在读取系统显示配置…
    </section>
    <section v-else-if="!displays.length" class="panel empty">
      {{ error ? '暂时无法获取设备，请重试。' : '未检测到活动显示器，连接设备后会自动刷新。' }}
    </section>
    <template v-else>
      <section class="panel layout-panel">
        <div class="section-heading">
          <h2>桌面布局</h2>
          <span class="hint">系统逻辑坐标 · 只读预览</span>
        </div>
        <DisplayLayout
          :displays="displays"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
      </section>
      <div class="device-grid">
        <nav class="devices" aria-label="选择显示器">
          <button
            v-for="(display, index) in displays"
            :key="display.id"
            class="device-card"
            :class="{ active: selectedId === display.id }"
            :aria-pressed="selectedId === display.id"
            @click="selectedId = display.id"
          >
            <span class="device-number">{{ index + 1 }}</span
            ><span class="device-copy"
              ><strong>{{ display.name }}</strong
              ><small
                >{{ display.pixelSize.width }} × {{ display.pixelSize.height }} ·
                {{
                  display.refreshRate === null
                    ? '刷新率未知'
                    : `${Math.round(display.refreshRate * 100) / 100} Hz`
                }}</small
              ></span
            ><span v-if="display.primary" class="badge">主屏</span>
          </button>
        </nav>
        <DisplayDetails v-if="selected" :display="selected" />
      </div>
    </template>
    <ControlPanel />
    <footer>
      仅访问本机显示配置，不读取屏幕内容。<span
        >{{ screenTools.platform }} · v{{ screenTools.version }}</span
      >
    </footer>
  </main>
</template>
