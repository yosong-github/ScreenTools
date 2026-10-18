<script setup lang="ts">
import type { ScreenFilterState } from '@screentools/contracts'
import ScreenFilters from '../filters/ScreenFilters.vue'

defineOptions({ name: 'ScreenFiltersPage' })

defineProps<{
  state: ScreenFilterState | undefined
  locked: boolean
}>()
</script>

<template>
  <section class="page-view">
    <div class="section-caption"><span>ICC 屏幕滤镜</span><span>所有显示器</span></div>
    <ScreenFilters :state="state" :locked="locked" />
  </section>
</template>
