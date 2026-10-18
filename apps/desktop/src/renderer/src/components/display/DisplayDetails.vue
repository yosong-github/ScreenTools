<script setup lang="ts">
import type { DisplayDevice } from '@screentools/contracts'
defineProps<{ display: DisplayDevice }>()
</script>
<template>
  <section class="panel details" aria-label="显示器详情">
    <div class="section-heading">
      <h2>{{ display.name }}</h2>
      <span class="badge">{{ display.primary ? '主显示器' : '活动显示器' }}</span>
    </div>
    <dl>
      <div>
        <dt>当前像素尺寸</dt>
        <dd>{{ display.pixelSize.width }} × {{ display.pixelSize.height }}</dd>
      </div>
      <div>
        <dt>刷新率</dt>
        <dd>
          {{
            display.refreshRate === null
              ? '未知'
              : `${Math.round(display.refreshRate * 100) / 100} Hz`
          }}
        </dd>
      </div>
      <div>
        <dt>系统缩放</dt>
        <dd>{{ Math.round(display.scaleFactor * 100) }}%</dd>
      </div>
      <div>
        <dt>方向</dt>
        <dd>
          {{ display.rotation }}° ·
          {{ display.bounds.width >= display.bounds.height ? '横向' : '纵向' }}
        </dd>
      </div>
      <div>
        <dt>桌面位置（DIP）</dt>
        <dd>{{ display.bounds.x }}, {{ display.bounds.y }}</dd>
      </div>
      <div>
        <dt>桌面尺寸（DIP）</dt>
        <dd>{{ display.bounds.width }} × {{ display.bounds.height }}</dd>
      </div>
      <div>
        <dt>工作区（DIP）</dt>
        <dd>{{ display.workArea.width }} × {{ display.workArea.height }}</dd>
      </div>
      <div>
        <dt>设备类型</dt>
        <dd>{{ display.internal ? '内置屏幕' : '外接 / 虚拟显示器' }}</dd>
      </div>
      <div>
        <dt>色深</dt>
        <dd>{{ display.colorDepth === null ? '未知' : `${display.colorDepth} bit` }}</dd>
      </div>
      <div>
        <dt>当前会话 ID</dt>
        <dd>{{ display.id }}</dd>
      </div>
    </dl>
    <p class="hint">
      当前像素尺寸由桌面区域换算，不代表面板原生分辨率。会话 ID 不用于跨重启设备匹配。
    </p>
    <div class="capabilities">
      <h3>硬件控制能力</h3>
      <p>DDC/CI、HDR、连接接口尚未探测。亮度、模式与拓扑写入将在原生适配器和回滚机制接入后开放。</p>
    </div>
  </section>
</template>
