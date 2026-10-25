<script setup lang="ts">
import { withBase } from 'vitepress'
import { downloadUrl, sitePath } from '../links'

const wordmark = 'SCREENTOOLS'.split('')

const tour: {
  index: string
  kicker: string
  badge?: string
  title: string
  body: string
  image: string
  alt: string
  href: string
}[] = [
  {
    index: '01',
    kicker: '屏幕信息',
    title: '分辨率、输入源、亮度与音量',
    body: '预览写出当前分辨率和刷新率。输入源默认只展示，打开「允许切换」并确认后才能改。亮度和显示器音量走 DDC/CI。',
    image: '/images/screen-info.png',
    alt: '屏幕信息页：分辨率预览、输入源、亮度和显示器音量',
    href: '/features#屏幕信息',
  },
  {
    index: '02',
    kicker: '画面配置',
    title: '拓扑、场景和硬件参数',
    body: '页内标题是「画面与配置」。扩展、复制、仅主屏、仅外屏需要 20 秒确认。场景、硬件亮度、对比度，以及支持时的 HDR，都在这一页。',
    image: '/images/picture-settings.png',
    alt: '画面配置页：显示拓扑、场景、硬件亮度和 HDR',
    href: '/features#画面配置',
  },
  {
    index: '03',
    kicker: '刷新率与清晰度',
    title: '只列出设备上报的模式',
    body: '页内标题是「分辨率与刷新率」。刷新率是一组选项，分辨率是可滚动列表。系统缩放仍由 Windows 管理。',
    image: '/images/display-modes.png',
    alt: '刷新率与清晰度页：刷新率选项和分辨率列表',
    href: '/features#刷新率与清晰度',
  },
  {
    index: '04',
    kicker: '屏幕滤镜 · 预设',
    badge: '新功能',
    title: '日常和 FPS，先预览再点击',
    body: '页内标题是「ICC 屏幕滤镜」。日常有原色、阅读、夜间、灰度；FPS 游戏有竞技、鲜艳、暗场、专注。分界线左右是原色和当前方案。',
    image: '/images/filter-presets.png',
    alt: '屏幕滤镜预设：日常与 FPS 分组，以及实时预览分界',
    href: '/features#屏幕滤镜',
  },
  {
    index: '04',
    kicker: '屏幕滤镜 · 自定义',
    badge: '新功能',
    title: '滑块预览，保存后才能套用',
    body: '「我的滤镜」里点击已保存的方案，才会作用到所有显示器。亮度、对比度、色温等滑块只更新预览。',
    image: '/images/filter-custom.png',
    alt: '自定义滤镜：已保存方案、实时预览和参数滑块',
    href: '/features#自定义滤镜',
  },
  {
    index: '05',
    kicker: '应用设置',
    title: '主题、自启动和版本',
    body: '齿轮进入，不是第五个标签。主题只改面板。开机自启动仅安装版可用。版本更新检查 GitHub Release，确认后才安装。',
    image: '/images/app-settings.png',
    alt: '应用设置：主题、开机自启动和版本更新',
    href: '/features#应用设置',
  },
]

const facts = [
  {
    index: '01',
    title: 'Win32 CCD',
    body: '读取并切换显示拓扑、分辨率与刷新率。会打断画面的系统配置，提交后需要在 20 秒内确认，否则尝试恢复。',
  },
  {
    index: '02',
    title: 'DDC/CI',
    body: '硬件亮度、对比度、音量和输入源取决于显示器。调节前，先在显示器菜单里打开 DDC/CI。',
  },
  {
    index: '03',
    title: '留在本机',
    body: '面板设置写在本机，不经过云端，也不需要管理员权限。',
  },
]

const marquee = [
  '屏幕信息',
  '画面配置',
  '刷新率与清晰度',
  '屏幕滤镜',
  '应用设置',
  'DDC/CI',
  'Win32 CCD',
  '本机运行',
]
</script>

<template>
  <div class="st-home">
    <section class="st-hero" aria-labelledby="hero-title">
      <div class="st-hero-grid" aria-hidden="true"></div>
      <div class="st-hero-inner">
        <p class="st-wordmark" role="img" aria-label="ScreenTools">
          <span
            v-for="(letter, index) in wordmark"
            :key="index"
            class="st-letter"
            :style="{ animationDelay: `${index * 42}ms` }"
            aria-hidden="true"
            >{{ letter }}</span
          >
        </p>
        <div class="st-hero-copy">
          <h1 id="hero-title">你的显示器，<em>一眼掌握。</em></h1>
          <p class="st-lede">
            在 Windows
            托盘里查看分辨率和输入源，调节亮度与音量，安排画面、刷新率和分辨率。控制留在本机。
          </p>
          <div class="st-actions">
            <a class="st-btn st-btn-solid" :href="downloadUrl" target="_blank" rel="noreferrer">
              下载 Windows 版
            </a>
            <a class="st-btn" :href="sitePath('/features')">了解功能</a>
          </div>
          <p class="st-hero-meta">
            <span>Windows x64</span>
            <span>托盘面板</span>
            <span>控制留在本机</span>
          </p>
        </div>
      </div>
    </section>

    <div class="st-marquee" aria-hidden="true">
      <ul class="st-marquee-track">
        <li v-for="label in marquee" :key="label"><i>▪</i>{{ label }}</li>
      </ul>
      <ul class="st-marquee-track">
        <li v-for="label in marquee" :key="`b-${label}`"><i>▪</i>{{ label }}</li>
      </ul>
    </div>

    <section class="st-section" aria-labelledby="panels-title">
      <div class="st-frame">
        <span class="st-tick st-tick-left" aria-hidden="true"></span>
        <span class="st-tick st-tick-right" aria-hidden="true"></span>
        <div class="st-section-bar">
          <p class="st-hud"><span>01</span> / 界面</p>
          <p class="st-hud st-hide-sm">四个图标页，外加设置</p>
        </div>
        <div class="st-section-intro">
          <h2 id="panels-title">打开托盘，<em>按页</em>往下看。</h2>
          <p>底部是四个图标页。齿轮打开应用设置，不是第五个标签。截图来自当前桌面面板。</p>
        </div>
        <div class="st-tour">
          <a
            v-for="item in tour"
            :key="item.kicker"
            class="st-tour-item"
            :href="sitePath(item.href)"
          >
            <div class="st-tour-copy">
              <p class="st-hud">
                <span>{{ item.index }}</span> / {{ item.kicker }}
                <em v-if="item.badge">{{ item.badge }}</em>
              </p>
              <h3>{{ item.title }}</h3>
              <p>{{ item.body }}</p>
            </div>
            <figure class="st-shot">
              <img :src="withBase(item.image)" :alt="item.alt" />
            </figure>
          </a>
        </div>
      </div>
    </section>

    <section class="st-section" aria-labelledby="local-title">
      <div class="st-frame">
        <span class="st-tick st-tick-left" aria-hidden="true"></span>
        <span class="st-tick st-tick-right" aria-hidden="true"></span>
        <div class="st-section-bar">
          <p class="st-hud"><span>02</span> / 本机</p>
          <p class="st-hud st-hide-sm">不经过云端</p>
        </div>
        <div class="st-section-intro">
          <h2 id="local-title">控制留在<em>这台电脑</em>上。</h2>
          <p>显示配置走 Windows 本机接口，硬件参数走 DDC/CI。不同显示器支持的命令不一样。</p>
        </div>
        <div class="st-facts">
          <article v-for="fact in facts" :key="fact.index">
            <p class="st-hud">{{ fact.index }}</p>
            <h3>{{ fact.title }}</h3>
            <p>{{ fact.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="st-section" aria-labelledby="start-title">
      <div class="st-frame st-close">
        <p class="st-hud">Windows x64 · 安装包在 GitHub Release</p>
        <h2 id="start-title">开始<em>使用</em>。</h2>
        <p>
          在最新版本的 Assets 里下载 ScreenTools-版本号-win-x64.exe。Source code
          压缩包不是安装程序。
        </p>
        <div class="st-actions">
          <a class="st-btn st-btn-solid" :href="downloadUrl" target="_blank" rel="noreferrer">
            下载 Windows 版
          </a>
          <a class="st-btn" :href="sitePath('/guide/getting-started')">查看快速开始</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.st-hero {
  position: relative;
  display: flex;
  min-height: calc(100svh - 48px);
  align-items: center;
  overflow: hidden;
}

.st-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 88px 88px;
  mask-image: radial-gradient(closest-side, #000 10%, transparent 78%);
  pointer-events: none;
}

.st-hero-inner {
  position: relative;
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: 72px 0 80px;
  container-type: inline-size;
}

.st-wordmark {
  margin: 0;
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: 9.4cqi;
  font-weight: 680;
  font-stretch: 125%;
  line-height: 0.86;
  letter-spacing: -0.04em;
  text-align: center;
  white-space: nowrap;
}

.st-letter {
  display: inline-block;
  animation: st-letter-in 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.st-hero-copy {
  max-width: 680px;
  margin: 36px auto 0;
  text-align: center;
}

.st-hero-copy h1,
.st-section-intro h2,
.st-close h2 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.st-hero-copy h1 {
  font-size: clamp(36px, 5vw, 60px);
}

.st-hero-copy em,
.st-section-intro em,
.st-close em {
  color: var(--muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
}

.st-lede,
.st-section-intro p,
.st-close p {
  color: var(--muted);
  font-size: 18px;
  line-height: 1.7;
}

.st-lede {
  margin: 16px 0 0;
}

.st-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
}

.st-btn {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  padding: 0 16px;
  border: 1px solid var(--ink);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  transition:
    background-color 120ms linear,
    color 120ms linear;
}

.st-btn:hover {
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-btn-solid {
  border-color: var(--invert-bg);
  background: var(--invert-bg);
  color: var(--invert-fg);
}

.st-btn-solid:hover {
  background: transparent;
  color: var(--ink);
}

.st-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.st-hero-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  margin: 22px 0 0;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.st-marquee {
  display: flex;
  overflow: hidden;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.st-marquee-track {
  display: flex;
  flex-shrink: 0;
  min-width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  animation: st-marquee 36s linear infinite;
}

.st-marquee:hover .st-marquee-track {
  animation-play-state: paused;
}

.st-marquee li {
  display: flex;
  align-items: center;
  padding: 12px 22px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
}

.st-marquee i {
  margin-right: 22px;
  color: var(--accent-ink);
  font-style: normal;
}

.st-section {
  position: relative;
}

.st-frame {
  position: relative;
  max-width: 1280px;
  margin: 0 auto;
  border-right: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.st-tick {
  position: absolute;
  top: -5px;
  z-index: 2;
  width: 11px;
  height: 11px;
  pointer-events: none;
}

.st-tick::before,
.st-tick::after {
  position: absolute;
  background: var(--line-strong);
  content: '';
}

.st-tick::before {
  top: 5px;
  bottom: 0;
  left: 5px;
  width: 1px;
}

.st-tick::after {
  top: 5px;
  right: 0;
  left: 0;
  height: 1px;
}

.st-tick-left {
  left: -6px;
}

.st-tick-right {
  right: -5px;
}

.st-section-bar {
  position: sticky;
  top: 48px;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(12px);
}

.st-section-intro {
  padding: 56px 24px 28px;
}

.st-section-intro h2,
.st-close h2 {
  max-width: 760px;
  font-size: clamp(36px, 5vw, 64px);
}

.st-section-intro p {
  max-width: 640px;
  margin: 18px 0 0;
}

.st-facts {
  display: grid;
  gap: 1px;
  background: var(--line);
  border-top: 1px solid var(--line);
}

.st-facts article {
  background: var(--bg);
}

.st-tour-copy .st-hud em {
  margin-left: 10px;
  color: var(--accent-ink);
  font-style: normal;
  letter-spacing: 0.14em;
}

.st-tour {
  border-top: 1px solid var(--line);
}

.st-tour-item {
  display: grid;
  gap: 22px;
  padding: 36px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  color: inherit;
  text-decoration: none;
}

.st-tour-copy h3,
.st-facts h3 {
  margin: 12px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.st-tour-copy p,
.st-facts article p {
  margin: 10px 0 0;
  color: var(--muted);
  line-height: 1.7;
}

.st-shot {
  margin: 0;
  padding: 16px 16px 0;
  border: 1px solid var(--line);
  background: var(--bg-sunken);
}

.st-shot img {
  display: block;
  width: min(100%, 280px);
  height: auto;
  margin: 0 auto;
}

.st-facts article {
  padding: 28px 24px 32px;
}

.st-facts h3 {
  margin-top: 14px;
}

.st-close {
  padding: 88px 24px;
  text-align: center;
}

.st-close h2,
.st-close p {
  margin-right: auto;
  margin-left: auto;
}

.st-close p {
  max-width: 520px;
  margin-top: 16px;
}

.st-close .st-hud {
  margin-bottom: 18px;
}

@keyframes st-letter-in {
  from {
    opacity: 0;
    transform: translateY(0.28em);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes st-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-100%);
  }
}

@media (min-width: 800px) {
  .st-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .st-tour-item {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 48px;
    align-items: center;
    padding: 48px 40px;
  }

  .st-tour-item:nth-child(even) .st-shot {
    order: -1;
  }
}

@media (max-width: 720px) {
  .st-hero {
    min-height: 0;
  }

  .st-hide-sm {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .st-letter,
  .st-marquee-track {
    animation: none;
    transition: none;
  }
}
</style>
