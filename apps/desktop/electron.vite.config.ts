import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      // workspace 包直接导出 TypeScript 源码，需要随主进程一起编译。
      externalizeDeps: {
        exclude: [
          '@screentools/contracts',
          '@screentools/display-control',
          '@screentools/display-native',
        ],
      },
      rolldownOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          'native-worker': resolve(import.meta.dirname, 'src/main/native-worker.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      // 沙箱预加载脚本不能加载任意外部依赖，需要将依赖打包进去。
      externalizeDeps: false,
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(import.meta.dirname, 'src/renderer/src'),
      },
    },
    plugins: [vue()],
  },
})
