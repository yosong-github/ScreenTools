import { defineConfig } from 'vitepress'

const base = '/ScreenTools/'

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'ScreenTools',
  description: '运行在托盘中的显示器控制工具',
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', href: `${base}logo.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#101112' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'ScreenTools',
    nav: [
      { text: '首页', link: '/' },
      { text: '功能预览', link: '/features' },
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '下载', link: 'https://github.com/yosong-github/ScreenTools/releases/latest' },
      { text: 'GitHub', link: 'https://github.com/yosong-github/ScreenTools' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [{ text: '快速开始', link: '/guide/getting-started' }],
        },
      ],
    },
    search: { provider: 'local' },
    outline: { label: '本页内容' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/yosong-github/ScreenTools' }],
    footer: {
      message: 'ScreenTools · 本地运行的显示器管理工具',
      copyright: '© ScreenTools contributors',
    },
  },
})
