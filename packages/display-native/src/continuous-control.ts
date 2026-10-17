import type { HardwareValue } from '@screentools/contracts'
import { percentageToRaw } from './validation'

// 连续参数只读取自身范围和回读值，不触发能力字符串及其他 VCP 探测。
export function writeContinuous(
  percentage: number,
  read: () => HardwareValue,
  write: (raw: number) => void,
): HardwareValue {
  const before = read()
  const target = percentageToRaw(percentage, before.min, before.max)
  if (target === before.current) return before
  write(target)
  // 返回设备实际值，不用请求值伪装写入结果。
  return read()
}
