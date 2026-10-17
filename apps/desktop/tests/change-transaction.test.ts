import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChangeTransaction } from '../src/main/services/change-transaction'
describe('显示变更事务', () => {
  afterEach(() => vi.useRealTimers())
  function fixture() {
    vi.useFakeTimers()
    const driver = {
      capture: () => ({ layout: 'original' }),
      restore: vi.fn(),
      persist: vi.fn(),
      changed: vi.fn(),
    }
    return { driver, transaction: createChangeTransaction(driver) }
  }
  it('未确认自动恢复原始快照', () => {
    const { driver, transaction } = fixture()
    transaction.apply(vi.fn())
    vi.advanceTimersByTime(20000)
    expect(driver.restore).toHaveBeenCalledWith({ layout: 'original' })
    expect(driver.persist).not.toHaveBeenCalled()
  })
  it('确认后持久化并取消回滚', () => {
    const { driver, transaction } = fixture()
    const change = transaction.apply(vi.fn())
    expect(() => transaction.confirm('wrong')).toThrow()
    transaction.confirm(change.token)
    vi.advanceTimersByTime(25000)
    expect(driver.persist).toHaveBeenCalledOnce()
    expect(driver.restore).not.toHaveBeenCalled()
  })
  it('应用失败立即恢复，禁止重入', () => {
    const { driver, transaction } = fixture()
    expect(() =>
      transaction.apply(() => {
        throw Error('驱动失败')
      }),
    ).toThrow('驱动失败')
    expect(driver.restore).toHaveBeenCalledOnce()
    const change = transaction.apply(vi.fn())
    expect(() => transaction.apply(vi.fn())).toThrow()
    expect(() => transaction.revert('wrong')).toThrow()
    transaction.revert(change.token)
    expect(driver.restore).toHaveBeenCalledTimes(2)
  })
  it('恢复失败保留快照，允许重试；持久化失败仍会回滚', () => {
    const { driver, transaction } = fixture()
    const change = transaction.apply(vi.fn())
    driver.persist.mockImplementationOnce(() => {
      throw Error('保存失败')
    })
    expect(() => transaction.confirm(change.token)).toThrow('保存失败')
    driver.restore.mockImplementationOnce(() => {
      throw Error('设备断开')
    })
    vi.advanceTimersByTime(20000)
    expect(driver.changed).toHaveBeenCalledWith('Error: 设备断开')
    transaction.revert(change.token)
    expect(driver.restore).toHaveBeenCalledTimes(2)
  })
})
