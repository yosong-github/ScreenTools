---
layout: home

hero:
  name: ScreenTools
  text: 你的显示器，一眼掌握。
  tagline: 在 Windows 托盘里快速查看显示状态，调整画面与硬件参数，切换刷新率和分辨率。所有控制都留在本机。
  image:
    src: /logo.svg
    alt: ScreenTools 显示器图标
  actions:
    - theme: brand
      text: 下载 Windows 版
      link: https://github.com/yosong-github/ScreenTools/releases/latest
    - theme: alt
      text: 了解功能
      link: /features

features:
  - icon: 🖥️
    title: 屏幕信息
    details: 当前分辨率、刷新率、连接方式和输入源，一眼可见；按设备能力调节亮度与音量。
    link: /features#屏幕信息
    linkText: 查看界面
  - icon: 🎛️
    title: 画面配置
    details: 扩展、复制与单屏模式；日间、阅读、观影、夜间场景，以及硬件亮度、对比度和 HDR。
    link: /features#画面配置
    linkText: 查看界面
  - icon: ⚡
    title: 刷新率与清晰度
    details: 按显示器支持的模式切换刷新率与分辨率，重要显示配置提供限时确认。
    link: /features#刷新率与清晰度
    linkText: 查看界面
  - icon: 🌓
    title: 屏幕滤镜
    details: 阅读、夜间、灰度和 FPS 预设，或自定义颜色。立即作用到所有显示器，退出后恢复。
    link: /features#屏幕滤镜
    linkText: 查看说明
---

<section class="home-showcase" aria-labelledby="showcase-title">
  <div class="showcase-heading">
    <span class="eyebrow">IN THE TRAY</span>
    <h2 id="showcase-title">常用操作，打开托盘就能完成</h2>
    <p>没有常驻主窗口。查看、配置和模式切换都在托盘里，屏幕滤镜是第四个页面。</p>
  </div>
  <div class="showcase-grid">
    <a class="showcase-card" href="./features.html#屏幕信息">
      <div class="showcase-image">
        <img src="/images/screen-info.png" alt="ScreenTools 屏幕信息页面截图" loading="lazy" />
      </div>
      <div class="showcase-copy">
        <h3>01 / 屏幕信息</h3>
        <p>设备概览、输入源、亮度与音量。</p>
      </div>
    </a>
    <a class="showcase-card" href="./features.html#画面配置">
      <div class="showcase-image">
        <img src="/images/picture-settings.png" alt="ScreenTools 画面配置页面截图" loading="lazy" />
      </div>
      <div class="showcase-copy">
        <h3>02 / 画面配置</h3>
        <p>显示拓扑、场景与硬件参数。</p>
      </div>
    </a>
    <a class="showcase-card" href="./features.html#刷新率与清晰度">
      <div class="showcase-image">
        <img src="/images/display-modes.png" alt="ScreenTools 刷新率与清晰度页面截图" loading="lazy" />
      </div>
      <div class="showcase-copy">
        <h3>03 / 刷新率与清晰度</h3>
        <p>快速选择设备支持的显示模式。</p>
      </div>
    </a>
  </div>
</section>

<section class="home-filter" aria-labelledby="filter-title">
  <div class="filter-copy">
    <span class="eyebrow">SCREEN FILTER</span>
    <h2 id="filter-title">给整个桌面套上颜色</h2>
    <p>
      在第四个页面切换阅读、夜间、灰度或 FPS 预设。颜色马上作用到所有显示器，不用等待 20 秒确认。退出应用后桌面回到原来的颜色；下次打开时，如果系统仍允许，会自动用回上次的选择。
    </p>
    <a class="filter-link" href="./guide/screen-filter.html">查看设置说明</a>
  </div>
  <FilterPlayground compact />
</section>
