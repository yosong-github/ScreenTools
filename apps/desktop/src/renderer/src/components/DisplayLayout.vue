<script setup lang="ts">
import { computed } from 'vue'
import type { DisplayDevice } from '@screentools/contracts'
const props = defineProps<{ displays: DisplayDevice[]; selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const viewBox = computed(() => {
  const bounds = props.displays.map((display) => display.bounds)
  if (!bounds.length) return '0 0 100 100'
  const x = Math.min(...bounds.map((b) => b.x))
  const y = Math.min(...bounds.map((b) => b.y))
  const right = Math.max(...bounds.map((b) => b.x + b.width))
  const bottom = Math.max(...bounds.map((b) => b.y + b.height))
  const padding = Math.max(right - x, bottom - y) * 0.06
  return `${x - padding} ${y - padding} ${right - x + padding * 2} ${bottom - y + padding * 2}`
})
</script>
<template>
  <svg :viewBox="viewBox" class="display-layout" aria-label="当前桌面布局，点击显示器查看详情">
    <g
      v-for="(display, index) in displays"
      :key="display.id"
      tabindex="0"
      role="button"
      :aria-label="`${display.name}${display.primary ? '，主屏' : ''}`"
      :aria-pressed="display.id === selectedId"
      :class="{ selected: display.id === selectedId }"
      @click="emit('select', display.id)"
      @keydown.enter="emit('select', display.id)"
      @keydown.space.prevent="emit('select', display.id)"
    >
      <rect
        :x="display.bounds.x + 5"
        :y="display.bounds.y + 5"
        :width="Math.max(1, display.bounds.width - 10)"
        :height="Math.max(1, display.bounds.height - 10)"
        rx="18"
      />
      <text
        :x="display.bounds.x + display.bounds.width / 2"
        :y="display.bounds.y + display.bounds.height / 2"
        :font-size="Math.min(display.bounds.width, display.bounds.height) * 0.14"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ index + 1 }}{{ display.primary ? ' · 主屏' : '' }}
      </text>
    </g>
  </svg>
</template>
