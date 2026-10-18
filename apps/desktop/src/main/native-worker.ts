import { createChangeTransaction } from './services/change-transaction'
import {
  apply,
  capture,
  enumerate,
  persist,
  pollHardware,
  probe,
  restore,
  writeHardware,
} from '@screentools/display-native/windows'
import type { ChangePlan, HardwarePollRequest, HardwareWriteRequest } from '@screentools/contracts'

const transaction = createChangeTransaction({
  capture: () => {
    const snapshot = capture()
    snapshot.colors = Object.fromEntries(
      enumerate(snapshot)
        .filter((d) => d.hdr?.supported)
        .map((d) => [d.id, d.hdr!.enabled]),
    )
    return snapshot
  },
  restore,
  persist,
  changed: (error) => process.send?.({ event: error ? 'recovery-error' : 'changed', error }),
})
process.on('message', (message: { id: number; operation: string; payload?: unknown }) => {
  try {
    let result: unknown
    switch (message.operation) {
      case 'snapshot':
        result = enumerate()
        break
      case 'probe':
        result = probe(message.payload as string)
        break
      case 'hardware':
        result = writeHardware(message.payload as HardwareWriteRequest)
        break
      case 'poll-hardware':
        result = pollHardware(message.payload as HardwarePollRequest)
        break
      case 'apply':
        result = transaction.apply(() => apply(message.payload as ChangePlan))
        break
      case 'confirm':
        transaction.confirm(message.payload as string)
        result = null
        break
      case 'revert':
        transaction.revert(message.payload as string)
        result = null
        break
      case 'dispose':
        transaction.revert()
        process.send?.({ id: message.id, result: null }, () => process.exit(0))
        return
      default:
        throw new Error('不支持的原生命令')
    }
    process.send?.({ id: message.id, result })
  } catch (error) {
    process.send?.({
      id: message.id,
      error: error instanceof Error ? error.message : '原生操作失败',
    })
  }
})
// 父进程崩溃或主动断开时仍恢复原配置，然后退出工作进程。
process.on('disconnect', () => {
  try {
    transaction.revert()
  } finally {
    process.exit(0)
  }
})
