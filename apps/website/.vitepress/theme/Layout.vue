<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HeroStage from './components/HeroStage.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-info-before>
      <p class="hero-kicker">
        <span>Windows x64</span>
        <span>托盘面板</span>
        <span>数据留在本机</span>
      </p>
    </template>
    <template #home-hero-image>
      <HeroStage />
    </template>
    <template #home-features-before>
      <div class="section-intro">
        <span class="eyebrow">CAPABILITIES</span>
        <h2>四个页面，覆盖日常调节</h2>
        <p>查看状态、配置画面、切换模式，以及给整个桌面加一层颜色。</p>
      </div>
    </template>
  </Layout>
</template>
