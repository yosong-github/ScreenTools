<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import SiteFooter from './components/SiteFooter.vue'
import SiteNav from './components/SiteNav.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <div class="st-shell">
    <SiteNav />
    <div id="st-main">
      <Layout />
    </div>
    <SiteFooter />
  </div>
</template>
