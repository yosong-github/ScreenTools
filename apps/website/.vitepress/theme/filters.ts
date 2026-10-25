import { getScreenFilterMatrix, toSvgColorMatrixValues } from '@screentools/display-core'

export type FilterId =
  | 'off'
  | 'reading'
  | 'night'
  | 'grayscale'
  | 'fps-competitive'
  | 'fps-vivid'
  | 'fps-dark'
  | 'fps-focus'

export interface FilterCard {
  id: FilterId
  label: string
  detail: string
}

export const filterGroups: readonly { label: string; items: readonly FilterCard[] }[] = [
  {
    label: '日常',
    items: [
      { id: 'off', label: '原色', detail: '恢复启用滤镜前读到的颜色矩阵' },
      { id: 'reading', label: '阅读', detail: '轻度降低绿色与蓝色' },
      { id: 'night', label: '夜间', detail: '降低整体亮度，并明显减少蓝色' },
      { id: 'grayscale', label: '灰度', detail: '按亮度把画面转为灰阶' },
    ],
  },
  {
    label: 'FPS 游戏',
    items: [
      { id: 'fps-competitive', label: '竞技', detail: '适度增强对比与色彩' },
      { id: 'fps-vivid', label: '鲜艳', detail: '明显提高色彩饱和度' },
      { id: 'fps-dark', label: '暗场', detail: '提亮暗部，整体对比更柔和' },
      { id: 'fps-focus', label: '专注', detail: '适度降低饱和度，减少色彩干扰' },
    ],
  },
]

export function svgMatrix(id: FilterId): string {
  return toSvgColorMatrixValues(getScreenFilterMatrix(id))
}
