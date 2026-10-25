<script setup lang="ts">
import { withBase } from 'vitepress'
import { downloadUrl, issuesUrl, releasesUrl, repoUrl, sitePath } from '../links'

const columns = [
  {
    label: '产品',
    links: [
      { text: '功能预览', href: sitePath('/features') },
      { text: '屏幕滤镜', href: sitePath('/guide/screen-filters') },
      { text: '快速开始', href: sitePath('/guide/getting-started') },
      { text: '下载 Windows 版', href: downloadUrl, external: true },
    ],
  },
  {
    label: '发布',
    links: [
      { text: '最新版本', href: downloadUrl, external: true },
      { text: '全部版本', href: releasesUrl, external: true },
    ],
  },
  {
    label: '项目',
    links: [
      { text: 'GitHub', href: repoUrl, external: true },
      { text: '问题反馈', href: issuesUrl, external: true },
    ],
  },
]
</script>

<template>
  <footer class="st-footer">
    <div class="st-frame">
      <div class="st-footer-grid">
        <div class="st-footer-brand">
          <img :src="withBase('/logo.svg')" alt="" width="28" height="28" />
          <p>运行在托盘里的 Windows 显示器工具。查看、配置和滤镜都留在本机。</p>
        </div>
        <nav v-for="column in columns" :key="column.label" :aria-label="column.label">
          <p class="st-hud">{{ column.label }}</p>
          <ul>
            <li v-for="link in column.links" :key="link.href">
              <a
                :href="link.href"
                :target="link.external ? '_blank' : undefined"
                :rel="link.external ? 'noreferrer' : undefined"
              >
                {{ link.text }}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div class="st-footer-bar">
        <p class="st-hud">© ScreenTools contributors</p>
        <p class="st-hud">MIT License</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.st-footer {
  border-top: 1px solid var(--line);
}

.st-frame {
  max-width: 1280px;
  margin: 0 auto;
  border-right: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.st-footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  background: var(--line);
}

.st-footer-brand,
.st-footer-grid nav {
  padding: 28px 24px 32px;
  background: var(--bg);
}

.st-footer-brand img {
  width: 28px;
  height: 28px;
}

.st-footer-brand p {
  max-width: 280px;
  margin: 16px 0 0;
  color: var(--muted);
  line-height: 1.7;
}

.st-footer-grid ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.st-footer-grid a {
  color: var(--muted);
  text-decoration: none;
}

.st-footer-grid a:hover {
  color: var(--ink);
}

.st-footer-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
}

@media (min-width: 800px) {
  .st-footer-grid {
    grid-template-columns: 1.4fr repeat(3, 1fr);
  }
}
</style>
