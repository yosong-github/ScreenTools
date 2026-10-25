<script setup lang="ts">
import { withBase } from 'vitepress'
import FilterCompare from './FilterCompare.vue'
import FilterSwatches from './FilterSwatches.vue'
import { downloadUrl, sitePath } from '../links'

const wordmark = 'SCREENTOOLS'.split('')

const panels = [
  {
    index: '01',
    kicker: '屏幕信息',
    title: '设备概览、输入源、亮度与音量',
    body: '当前分辨率、刷新率、连接方式和输入源，一眼可见；按设备能力调节亮度与音量。',
    image: '/images/screen-info.png',
    alt: 'ScreenTools 屏幕信息页面截图',
    href: '/features#屏幕信息',
  },
  {
    index: '02',
    kicker: '画面配置',
    title: '显示拓扑、场景与硬件参数',
    body: '扩展、复制与单屏模式；日间、阅读、观影、夜间场景，以及硬件亮度、对比度和 HDR。',
    image: '/images/picture-settings.png',
    alt: 'ScreenTools 画面配置页面截图',
    href: '/features#画面配置',
  },
  {
    index: '03',
    kicker: '刷新率与清晰度',
    title: '按设备支持的模式切换',
    body: '按显示器支持的模式切换刷新率与分辨率，重要显示配置提供限时确认。',
    image: '/images/display-modes.png',
    alt: 'ScreenTools 刷新率与清晰度页面截图',
    href: '/features#刷新率与清晰度',
  },
]

const steps = [
  { index: '01', title: '打开面板', body: '点击托盘图标，或按 Ctrl+Alt+D。没有单独的滤镜快捷键。' },
  {
    index: '02',
    title: '进入屏幕滤镜',
    body: '第四个页面。标题是「ICC 屏幕滤镜」，并写明所有显示器。',
  },
  {
    index: '03',
    title: '先预览，再点击',
    body: '悬停或聚焦只更新预览。点击后立即作用于整个桌面。',
  },
  { index: '04', title: '退出即恢复', body: '点「原色」或退出应用，颜色矩阵回到启用前的状态。' },
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
    body: '设置和滤镜方案写在本机，不经过云端。屏幕滤镜不改硬件参数，也不需要管理员权限。',
  },
]

const marquee = [
  '屏幕信息',
  '画面配置',
  '刷新率与清晰度',
  '屏幕滤镜',
  '显示方案',
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
            托盘里快速查看显示状态，调整画面与硬件参数，切换刷新率和分辨率。所有控制都留在本机。
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
          <p class="st-hud st-hide-sm">四个页面，都在托盘里</p>
        </div>
        <div class="st-section-intro">
          <h2 id="panels-title">常用操作，打开<em>托盘</em>就能完成。</h2>
          <p>没有常驻主窗口。查看、配置、切换模式，以及屏幕滤镜，都从同一个面板进入。</p>
        </div>
        <div class="st-cards">
          <a
            v-for="panel in panels"
            :key="panel.index"
            class="st-card"
            :href="sitePath(panel.href)"
          >
            <div class="st-card-bar">
              <p class="st-hud">{{ panel.kicker }}</p>
              <p class="st-hud">{{ panel.index }}</p>
            </div>
            <div class="st-card-media">
              <img :src="withBase(panel.image)" :alt="panel.alt" />
            </div>
            <div class="st-card-copy">
              <h3>{{ panel.title }}</h3>
              <p>{{ panel.body }}</p>
            </div>
          </a>
          <a class="st-card" :href="sitePath('/guide/screen-filters')">
            <div class="st-card-bar">
              <p class="st-hud">屏幕滤镜</p>
              <p class="st-hud">04</p>
            </div>
            <div class="st-card-spec">
              <p>所有显示器</p>
              <ul>
                <li>原色</li>
                <li>阅读</li>
                <li>夜间</li>
                <li>灰度</li>
                <li>FPS 竞技</li>
                <li>FPS 鲜艳</li>
                <li>FPS 暗场</li>
                <li>FPS 专注</li>
              </ul>
            </div>
            <div class="st-card-copy">
              <h3>点一下，整个桌面换颜色</h3>
              <p>预设和自定义滤镜立即生效，不进入 20 秒确认。退出应用后恢复原来的颜色。</p>
            </div>
          </a>
        </div>
      </div>
    </section>

    <section id="filters" class="st-section" aria-labelledby="filters-title">
      <div class="st-frame">
        <span class="st-tick st-tick-left" aria-hidden="true"></span>
        <span class="st-tick st-tick-right" aria-hidden="true"></span>
        <div class="st-section-bar">
          <p class="st-hud"><span>02</span> / 屏幕滤镜</p>
          <p class="st-hud st-hide-sm">颜色矩阵 · 所有显示器</p>
        </div>
        <div class="st-section-intro">
          <h2 id="filters-title">先看差别，<em>再</em>应用到桌面。</h2>
          <p>
            托盘页标题写着「ICC 屏幕滤镜」。实际效果是 Windows 全屏颜色矩阵，不安装 ICC
            描述文件，也不改显示器硬件。同一时间只有一个滤镜，而且一定会作用到全部显示器。
          </p>
        </div>
        <ol class="st-home-steps">
          <li v-for="step in steps" :key="step.index">
            <span>{{ step.index }}</span>
            <strong>{{ step.title }}</strong>
            <p>{{ step.body }}</p>
          </li>
        </ol>
        <FilterCompare />
        <div class="st-swatch-wrap">
          <FilterSwatches />
        </div>
        <p class="st-section-link">
          <a :href="sitePath('/guide/screen-filters')">查看设置说明</a>
        </p>
      </div>
    </section>

    <section class="st-section" aria-labelledby="local-title">
      <div class="st-frame">
        <span class="st-tick st-tick-left" aria-hidden="true"></span>
        <span class="st-tick st-tick-right" aria-hidden="true"></span>
        <div class="st-section-bar">
          <p class="st-hud"><span>03</span> / 本机</p>
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
  max-width: 640px;
  margin: 28px auto 0;
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

.st-cards,
.st-facts,
.st-home-steps {
  display: grid;
  gap: 1px;
  background: var(--line);
  border-top: 1px solid var(--line);
}

.st-card {
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: inherit;
  text-decoration: none;
}

.st-card-bar,
.st-card-copy,
.st-facts article,
.st-home-steps li {
  background: var(--bg);
}

.st-card-bar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
}

.st-card-media,
.st-card-spec {
  display: flex;
  min-height: 420px;
  align-items: flex-end;
  justify-content: center;
  background: var(--bg-sunken);
}

.st-card-media {
  overflow: hidden;
  padding: 28px 20px 0;
}

.st-card-media img {
  width: min(300px, 78%);
  height: auto;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.st-card:hover img {
  transform: translateY(-8px);
}

.st-card-spec {
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 28px;
}

.st-card-spec p,
.st-card-spec li {
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.st-card-spec p {
  margin: 0 0 18px;
  color: var(--faint);
  font-size: 11px;
}

.st-card-spec ul {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-card-spec li {
  color: var(--ink);
  font-size: 13px;
}

.st-card-spec li::before {
  margin-right: 8px;
  color: var(--accent-ink);
  content: '▪';
}

.st-card-copy {
  padding: 22px 22px 28px;
}

.st-card-copy h3,
.st-facts h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.st-card-copy p,
.st-facts article p,
.st-home-steps p {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.7;
}

.st-home-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-home-steps li {
  padding: 22px;
}

.st-home-steps span {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
}

.st-home-steps strong {
  display: block;
  margin-top: 10px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.st-swatch-wrap {
  padding: 28px 24px 8px;
  border-top: 1px solid var(--line);
}

.st-section-link {
  margin: 0;
  padding: 8px 24px 36px;
}

.st-section-link a {
  color: var(--accent-ink);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
}

.st-section-link a:hover {
  color: var(--ink);
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
  .st-home-steps,
  .st-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .st-home-steps {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 980px) {
  .st-cards {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .st-hero {
    min-height: 0;
  }

  .st-hide-sm {
    display: none;
  }

  .st-card-media,
  .st-card-spec {
    min-height: 320px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .st-letter,
  .st-marquee-track,
  .st-card-media img {
    animation: none;
    transition: none;
  }
}
</style>
