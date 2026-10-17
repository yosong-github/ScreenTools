import type { ScreenToolsApi } from '@screentools/contracts'

// 统一收口预加载接口，组件通过导入使用。
if (!window.screenTools) {
  throw new Error('ScreenTools 预加载接口未就绪')
}

export const screenTools: Readonly<ScreenToolsApi> = window.screenTools
