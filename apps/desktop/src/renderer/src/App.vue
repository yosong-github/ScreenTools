<script setup lang="ts">
const features = [
  { title: '显示器概览', description: '等待接入 Windows 显示配置适配器' },
  { title: '显示器布局', description: '等待实现拓扑和模式管理' },
  { title: '配置方案', description: '等待实现本地方案存储' },
]

const { platform, version } = window.screenTools
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">ScreenTools</p>
        <h1>显示器管理控制中心</h1>
        <p class="subtitle">Electron 与 Vue 3 项目空壳已经就绪</p>
      </div>
      <span class="status">{{ platform }} · v{{ version }}</span>
    </header>

    <section class="feature-grid" aria-label="功能模块">
      <article v-for="feature in features" :key="feature.title" class="feature-card">
        <div class="placeholder" aria-hidden="true"></div>
        <h2>{{ feature.title }}</h2>
        <p>{{ feature.description }}</p>
      </article>
    </section>

    <footer>当前版本只包含工程基础设施和安全的 Electron 进程边界，不包含显示器控制实现。</footer>
  </main>
</template>
