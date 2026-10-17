import { describe, expect, it, vi } from 'vitest'
import { writeContinuous } from './continuous-control'

describe('连续硬件参数快速写入', () => {
  it('只读自身范围、写入一次并回读，使用设备实际值', () => {
    const read = vi
      .fn()
      .mockReturnValueOnce({ min: 10, max: 210, current: 20 })
      .mockReturnValueOnce({ min: 10, max: 210, current: 109 })
    const write = vi.fn()
    expect(writeContinuous(50, read, write).current).toBe(109)
    expect(write).toHaveBeenCalledExactlyOnceWith(110)
    expect(read).toHaveBeenCalledTimes(2)
  })
  it('相同目标值不重复写入或回读', () => {
    const read = vi.fn(() => ({ min: 0, max: 100, current: 50 }))
    const write = vi.fn()
    expect(writeContinuous(50, read, write).current).toBe(50)
    expect(read).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
  })
  it('读取失败不写入，写入或回读失败不返回虚假成功', () => {
    const write = vi.fn()
    expect(() =>
      writeContinuous(
        50,
        () => {
          throw Error('读取失败')
        },
        write,
      ),
    ).toThrow('读取失败')
    expect(write).not.toHaveBeenCalled()
    const read = vi.fn(() => ({ min: 0, max: 100, current: 20 }))
    expect(() =>
      writeContinuous(50, read, () => {
        throw Error('写入失败')
      }),
    ).toThrow('写入失败')
    expect(read).toHaveBeenCalledOnce()
    read
      .mockImplementationOnce(() => ({ min: 0, max: 100, current: 20 }))
      .mockImplementationOnce(() => {
        throw Error('回读失败')
      })
    expect(() => writeContinuous(50, read, write)).toThrow('回读失败')
  })
})
