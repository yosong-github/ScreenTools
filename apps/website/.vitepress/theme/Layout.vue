<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { downloadUrl, sitePath } from './links'
import SiteFooter from './components/SiteFooter.vue'
import SiteNav from './components/SiteNav.vue'

const { Layout } = DefaultTheme

const missingLinks = [
  { href: '/', label: '首页' },
  { href: '/features', label: '功能预览' },
  { href: '/guide/screen-filters', label: '屏幕滤镜' },
  { href: '/guide/getting-started', label: '快速开始' },
  { href: downloadUrl, label: '下载 Windows 版' },
]
</script>

<template>
  <div class="st-shell">
    <SiteNav />
    <div id="st-main">
      <Layout>
        <template #not-found>
          <article class="vp-doc st-missing">
            <p class="st-kicker"><span>404</span> / 未找到</p>
            <h1>没有这一页</h1>
            <p>链接可能写错了，或者页面已经挪走。可以从下面继续。</p>
            <ul>
              <li v-for="link in missingLinks" :key="link.href">
                <a
                  :href="sitePath(link.href)"
                  :target="link.href.startsWith('http') ? '_blank' : undefined"
                  :rel="link.href.startsWith('http') ? 'noreferrer' : undefined"
                  >{{ link.label }}</a
                >
              </li>
            </ul>
          </article>
        </template>
      </Layout>
    </div>
    <SiteFooter />
  </div>
</template>
