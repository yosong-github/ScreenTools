<script setup lang="ts">
import { screenTools } from '@renderer/api/screen-tools'

const { platform, version } = screenTools
</script>

<template>
  <main>
    <p class="brand">ScreenTools</p>
    <h1>显示器管理</h1>
    <p>项目已就绪，等待接入显示器控制功能。</p>
    <small>{{ platform }} · v{{ version }}</small>
  </main>
</template>
