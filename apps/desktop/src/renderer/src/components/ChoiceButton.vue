<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  variant: {
    type: String as PropType<'choice' | 'scene' | 'source' | 'resolution'>,
    default: 'choice',
  },
  pressed: { type: Boolean, default: undefined },
})
</script>

<template>
  <button type="button" :class="[`${variant}-option`, { chosen: pressed }]" :aria-pressed="pressed">
    <slot />
  </button>
</template>
