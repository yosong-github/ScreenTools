import { createRouter, createWebHashHistory } from 'vue-router'

export const trayTabs = [
  { name: 'info', icon: 'monitor', label: '屏幕信息' },
  { name: 'picture', icon: 'sliders', label: '画面配置' },
  { name: 'modes', icon: 'resolution', label: '刷新率与清晰度' },
  { name: 'filters', icon: 'contrast', label: '屏幕滤镜' },
] as const

export type TrayTab = (typeof trayTabs)[number]['name']

export const router = createRouter({
  // 安装包用 loadFile 打开本地页面，hash 路由不依赖服务器回退。
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: { name: 'info' } },
    {
      path: '/info',
      name: 'info',
      component: () => import('@renderer/views/screen-info/ScreenInfoView.vue'),
    },
    {
      path: '/picture',
      name: 'picture',
      component: () => import('@renderer/views/picture/PictureSettingsView.vue'),
    },
    {
      path: '/modes',
      name: 'modes',
      component: () => import('@renderer/views/modes/DisplayModesView.vue'),
    },
    {
      path: '/filters',
      name: 'filters',
      component: () => import('@renderer/views/filters/ScreenFiltersView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@renderer/views/settings/AppSettingsView.vue'),
    },
  ],
})
