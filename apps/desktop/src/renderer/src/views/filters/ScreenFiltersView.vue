<script setup lang="ts">
import { useTraySession } from '@renderer/composables/useTraySession'
import ScreenFilters from './ScreenFilters.vue'

defineOptions({ name: 'ScreenFiltersView' })

const { screenFilter, locked } = useTraySession()
</script>

<template>
  <section class="page-view">
    <div class="section-caption"><span>ICC 屏幕滤镜</span><span>所有显示器</span></div>
    <ScreenFilters :state="screenFilter" :locked="locked" />
  </section>
</template>
