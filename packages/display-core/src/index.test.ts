import { describe, expect, it } from 'vitest'
import { createInitialDisplayState } from './index'

describe('createInitialDisplayState', () => {
  it('creates an empty idle state', () => {
    expect(createInitialDisplayState()).toEqual({
      displays: [],
      loading: false,
      error: null,
    })
  })
})
