import { defineConfig } from 'vitepress'

const base = '/ScreenTools/'

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'ScreenTools',
  description:
    '运行在 Windows 托盘中的显示器控制工具，可查看显示状态、调整画面，并设置全屏屏幕滤镜。',
  appearance: true,
  head: [
    ['link', { rel: 'icon', href: `${base}logo.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#f2f1ee', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#121316', media: '(prefers-color-scheme: dark)' }],
  ],
  vite: {
    server: {
      fs: {
        allow: ['.', '../..'],
      },
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'ScreenTools',
    nav: [
      { text: '首页', link: '/' },
      { text: '功能预览', link: '/features' },
      { text: '屏幕滤镜', link: '/guide/screen-filters' },
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '下载', link: 'https://github.com/yosong-github/ScreenTools/releases/latest' },
      { text: 'GitHub', link: 'https://github.com/yosong-github/ScreenTools' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '屏幕滤镜', link: '/guide/screen-filters' },
          ],
        },
      ],
      '/features': [
        {
          text: '功能预览',
          items: [
            { text: '屏幕信息', link: '/features#屏幕信息' },
            { text: '画面配置', link: '/features#画面配置' },
            { text: '刷新率与清晰度', link: '/features#刷新率与清晰度' },
            { text: '屏幕滤镜', link: '/features#屏幕滤镜' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonTitle: '清除查询',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有匹配结果',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '向上',
              navigateDownKeyAriaLabel: '向下',
              closeText: '关闭',
              closeKeyAriaLabel: 'esc',
            },
          },
        },
      },
    },
    outline: { label: '本页内容', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    socialLinks: [{ icon: 'github', link: 'https://github.com/yosong-github/ScreenTools' }],
    footer: {
      message: 'ScreenTools · 本地运行的显示器管理工具',
      copyright: '© ScreenTools contributors',
    },
  },
})
