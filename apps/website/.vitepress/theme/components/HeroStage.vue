<template>
  <figure class="hero-stage">
    <div class="hero-panel" aria-hidden="true">
      <header class="hero-panel-bar">
        <svg class="hero-mark" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#ef6208" />
          <rect
            x="15"
            y="16"
            width="34"
            height="26"
            rx="4"
            fill="none"
            stroke="#fff"
            stroke-width="3"
          />
          <path
            d="M25 49h14M32 42v7"
            fill="none"
            stroke="#fff"
            stroke-linecap="round"
            stroke-width="3"
          />
        </svg>
        <span class="hero-panel-name">
          <strong>ScreenTools</strong>
          <em>所有显示器</em>
        </span>
        <span class="hero-pill">滤镜可用</span>
      </header>
      <div class="hero-tabs">
        <span></span>
        <span></span>
        <span></span>
        <span class="is-on"></span>
      </div>
      <div class="hero-card">
        <div class="hero-card-title">
          <strong>屏幕滤镜</strong>
          <span>所有显示器</span>
        </div>
        <p>日常</p>
        <div class="hero-chips">
          <span>原色</span>
          <span class="is-on">阅读</span>
          <span>夜间</span>
          <span>灰度</span>
        </div>
        <p>FPS 游戏</p>
        <div class="hero-chips">
          <span>竞技</span>
          <span>鲜艳</span>
          <span>暗场</span>
          <span>专注</span>
        </div>
        <small>作用于所有显示器，退出 ScreenTools 后恢复</small>
      </div>
    </div>
    <figcaption>第四个标签「屏幕滤镜」的界面示意</figcaption>
  </figure>
</template>

<style scoped>
.hero-stage {
  width: min(100%, 420px);
  margin: 0;
}

.hero-panel {
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 28px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--vp-c-bg-elv) 88%, white 12%),
      var(--vp-c-bg-soft)
    ),
    var(--vp-c-bg-soft);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 16%, transparent),
    var(--st-shadow);
}

.hero-panel-bar,
.hero-card-title,
.hero-chips {
  display: flex;
  align-items: center;
}

.hero-panel-bar {
  gap: 10px;
}

.hero-mark {
  width: 34px;
  height: 34px;
  flex: none;
}

.hero-panel-name {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.hero-panel-name strong {
  color: var(--vp-c-text-1);
  font-size: 14px;
  letter-spacing: -0.02em;
}

.hero-panel-name em {
  color: var(--vp-c-text-3);
  font-size: 12px;
  font-style: normal;
}

.hero-pill,
.hero-card-title span {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
}

.hero-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0;
  padding: 6px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--vp-c-bg) 72%, transparent);
}

.hero-tabs span {
  height: 28px;
  border-radius: 9px;
}

.hero-tabs span.is-on {
  background: linear-gradient(180deg, #ff8a33, #ef6208);
  box-shadow: 0 6px 16px rgba(239, 98, 8, 0.28);
}

.hero-card {
  padding: 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
}

.hero-card-title {
  justify-content: space-between;
  margin-bottom: 12px;
}

.hero-card-title strong {
  color: var(--vp-c-text-1);
  font-size: 13px;
}

.hero-card p {
  margin: 10px 0 6px;
  color: var(--vp-c-text-3);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.hero-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.hero-chips span {
  padding: 8px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  text-align: center;
}

.hero-chips span.is-on {
  border-color: #ff8129;
  background: #633310;
  color: #f6f1ea;
}

.hero-card small {
  display: block;
  margin-top: 12px;
  color: var(--vp-c-text-3);
  font-size: 11px;
  line-height: 1.5;
}

figcaption {
  margin-top: 10px;
  color: var(--vp-c-text-3);
  font-size: 12px;
  text-align: center;
}
</style>
