<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { downloadUrl, repoUrl, sitePath } from '../links'

const route = useRoute()
const { isDark } = useData()
const open = ref(false)

const links = [
  { text: '首页', path: '/' },
  { text: '功能', path: '/features' },
  { text: '开始', path: '/guide/getting-started' },
  { text: '滤镜', path: '/guide/screen-filters' },
]

function normalize(path: string): string {
  const bare = path.replace(/\.html$/, '').replace(/\/$/, '')
  return bare || '/'
}

function isActive(path: string): boolean {
  return normalize(route.path) === normalize(path)
}

const themeLabel = computed(() => (isDark.value ? '切换到浅色' : '切换到深色'))

watch(
  () => route.path,
  () => {
    open.value = false
  },
)

function toggleTheme(): void {
  isDark.value = !isDark.value
}

function openSearch(): void {
  document.querySelector<HTMLButtonElement>('#local-search button')?.click()
}
</script>

<template>
  <header class="st-nav">
    <a class="st-skip" href="#st-main">跳到内容</a>
    <a class="st-brand" :href="sitePath('/')" aria-label="ScreenTools 首页">
      <img :src="withBase('/logo.svg')" alt="" width="22" height="22" />
      <span>ScreenTools</span>
    </a>
    <nav class="st-nav-links" aria-label="主导航">
      <a
        v-for="link in links"
        :key="link.path"
        :href="sitePath(link.path)"
        :class="{ 'is-active': isActive(link.path) }"
        :aria-current="isActive(link.path) ? 'page' : undefined"
      >
        <span>{{ link.text }}</span>
      </a>
    </nav>
    <div class="st-nav-tools">
      <a class="st-icon-btn" :href="repoUrl" target="_blank" rel="noreferrer" aria-label="GitHub">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.7 7.7 0 0 1 8 3.77c.68.003 1.36.092 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
          />
        </svg>
      </a>
      <button class="st-icon-btn" type="button" :aria-label="themeLabel" @click="toggleTheme">
        <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path
            d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="square"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M16.5 14.5A6.5 6.5 0 0 1 9 5.2 6.5 6.5 0 1 0 16.5 14.5Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button class="st-icon-btn" type="button" aria-label="搜索" @click="openSearch">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </button>
      <a class="st-download" :href="downloadUrl" target="_blank" rel="noreferrer">下载</a>
      <button
        class="st-icon-btn st-menu-btn"
        type="button"
        :aria-expanded="open"
        aria-controls="st-nav-panel"
        @click="open = !open"
      >
        <span class="sr-only">{{ open ? '关闭菜单' : '打开菜单' }}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </button>
    </div>
    <nav v-if="open" id="st-nav-panel" class="st-nav-panel" aria-label="移动导航">
      <a v-for="link in links" :key="link.path" :href="sitePath(link.path)">{{ link.text }}</a>
      <a :href="downloadUrl" target="_blank" rel="noreferrer">下载 Windows 版</a>
      <a :href="repoUrl" target="_blank" rel="noreferrer">GitHub</a>
    </nav>
  </header>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.st-skip {
  position: absolute;
  left: 12px;
  top: -40px;
  z-index: 2;
  padding: 8px 12px;
  background: var(--invert-bg);
  color: var(--invert-fg);
  font-family: var(--font-mono);
  font-size: 12px;
}

.st-skip:focus {
  top: 8px;
}

.st-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 60;
  display: flex;
  height: 48px;
  align-items: stretch;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
}

.st-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-right: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
}

.st-brand img {
  width: 22px;
  height: 22px;
}

.st-brand span {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.st-nav-links {
  display: none;
  min-width: 0;
  align-items: stretch;
}

.st-nav-links a {
  display: flex;
  align-items: center;
  padding: 0 2px;
  color: var(--ink);
  text-decoration: none;
}

.st-nav-links span {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.st-nav-links a:hover span,
.st-nav-links a.is-active span {
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-nav-tools {
  display: flex;
  align-items: stretch;
  margin-left: auto;
}

.st-icon-btn,
.st-download {
  display: flex;
  width: 48px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-left: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  text-decoration: none;
  cursor: pointer;
}

.st-icon-btn svg {
  width: 16px;
  height: 16px;
}

.st-icon-btn:hover,
.st-download:hover {
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-download {
  width: auto;
  padding: 0 16px;
  background: var(--invert-bg);
  color: var(--invert-fg);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.st-download:hover {
  background: transparent;
  color: var(--ink);
}

.st-nav-panel {
  position: absolute;
  top: 48px;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
}

.st-nav-panel a {
  padding: 14px 18px;
  border-top: 1px solid var(--line);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
}

.st-nav-panel a:hover {
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-brand:focus-visible,
.st-nav-links a:focus-visible,
.st-icon-btn:focus-visible,
.st-download:focus-visible,
.st-nav-panel a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

@media (min-width: 960px) {
  .st-nav-links {
    display: flex;
  }

  .st-menu-btn,
  .st-nav-panel {
    display: none;
  }
}

@media (max-width: 719px) {
  .st-download {
    display: none;
  }

  .st-brand span {
    display: none;
  }
}
</style>
