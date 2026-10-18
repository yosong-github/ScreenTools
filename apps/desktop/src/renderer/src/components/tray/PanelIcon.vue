<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'monitor'">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M4 5h8m4 0h4M4 12h3m4 0h9M4 19h10m4 0h2" />
      <path d="M12 3v4M9 10v4M16 17v4" />
    </template>
    <template v-else-if="name === 'resolution'">
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M3 8v8m18-8v8M9 6h6M9 18h6" />
    </template>
    <template v-else-if="name === 'power'"><path d="M12 2v10M6.2 5.7a9 9 0 1 0 11.6 0" /></template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 11a8 8 0 1 0-2.3 6.7M20 4v7h-7" />
    </template>
    <template v-else-if="name === 'settings'">
      <path
        d="M10.2 2.7h3.6l.7 2.1c.5.2 1 .4 1.5.7l2-.9 2.5 2.5-.9 2c.3.5.5 1 .7 1.5l2.1.7v3.6l-2.1.7c-.2.5-.4 1-.7 1.5l.9 2-2.5 2.5-2-.9c-.5.3-1 .5-1.5.7l-.7 2.1h-3.6l-.7-2.1c-.5-.2-1-.4-1.5-.7l-2 .9-2.5-2.5.9-2c-.3-.5-.5-1-.7-1.5l-2.1-.7v-3.6l2.1-.7c.2-.5.4-1 .7-1.5l-.9-2 2.5-2.5 2 .9c.5-.3 1-.5 1.5-.7l.7-2.1Z"
      />
      <circle cx="12" cy="12" r="3" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </template>
    <template v-else-if="name === 'volume'">
      <path d="M4 9v6h4l5 4V5L8 9H4ZM17 9a4 4 0 0 1 0 6M19.5 6a8 8 0 0 1 0 12" />
    </template>
    <template v-else-if="name === 'cable'">
      <path d="M8 2v5m8-5v5M6 7h12v4a6 6 0 0 1-12 0V7Zm6 10v5" />
    </template>
    <template v-else-if="name === 'gauge'">
      <path d="M4 17a9 9 0 1 1 16 0M12 13l4-5M10 19h4" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path
        d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17Z"
      />
    </template>
    <template v-else-if="name === 'contrast'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18V3Z" />
    </template>
    <template v-else-if="name === 'check'"><path d="m5 12 4 4L19 6" /></template>
    <template v-else-if="name === 'layout'">
      <rect x="3" y="4" width="8" height="7" rx="1" />
      <rect x="13" y="4" width="8" height="7" rx="1" />
      <rect x="3" y="13" width="18" height="7" rx="1" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </template>
    <template v-else-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="name === 'minus'"><path d="M5 12h14" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m15 18-6-6 6-6" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m9 18 6-6-6-6" /></template>
  </svg>
</template>
