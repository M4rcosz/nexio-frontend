import { describe, it, expect } from 'vitest'
import {
  clampWorkflowPaging,
  hasNextWorkflowPage,
  parseWorkflowOffset,
  previousWorkflowOffset,
} from './paging'

describe('clampWorkflowPaging — limit (§2.6: 1–100, default 20)', () => {
  it('defaults a missing limit to 20', () => {
    expect(clampWorkflowPaging().limit).toBe(20)
    expect(clampWorkflowPaging({}).limit).toBe(20)
    expect(clampWorkflowPaging({ limit: undefined }).limit).toBe(20)
    expect(clampWorkflowPaging({ limit: null }).limit).toBe(20)
  })

  it('keeps the boundaries', () => {
    expect(clampWorkflowPaging({ limit: 1 }).limit).toBe(1)
    expect(clampWorkflowPaging({ limit: 100 }).limit).toBe(100)
  })

  it('clamps out-of-range values instead of letting the server refuse', () => {
    expect(clampWorkflowPaging({ limit: 0 }).limit).toBe(1)
    expect(clampWorkflowPaging({ limit: -5 }).limit).toBe(1)
    expect(clampWorkflowPaging({ limit: 101 }).limit).toBe(100)
    expect(clampWorkflowPaging({ limit: 10_000 }).limit).toBe(100)
  })

  it('falls back on NaN and Infinity', () => {
    expect(clampWorkflowPaging({ limit: Number.NaN }).limit).toBe(20)
    expect(clampWorkflowPaging({ limit: Number.POSITIVE_INFINITY }).limit).toBe(
      20,
    )
  })

  it('truncates a fractional limit', () => {
    expect(clampWorkflowPaging({ limit: 20.7 }).limit).toBe(20)
  })
})

describe('clampWorkflowPaging — offset (§2.6: 0–10000)', () => {
  it('defaults a missing offset to 0', () => {
    expect(clampWorkflowPaging().offset).toBe(0)
  })

  it('keeps the boundaries', () => {
    expect(clampWorkflowPaging({ offset: 0 }).offset).toBe(0)
    expect(clampWorkflowPaging({ offset: 10_000 }).offset).toBe(10_000)
  })

  it('clamps a negative and an over-max offset', () => {
    expect(clampWorkflowPaging({ offset: -5 }).offset).toBe(0)
    expect(clampWorkflowPaging({ offset: 10_001 }).offset).toBe(10_000)
  })

  it('falls back on NaN', () => {
    expect(clampWorkflowPaging({ offset: Number.NaN }).offset).toBe(0)
  })
})

describe('parseWorkflowOffset', () => {
  it('reads a numeric search param', () => {
    expect(parseWorkflowOffset('40')).toBe(40)
  })

  it('treats absent, empty and non-numeric values as the first page', () => {
    expect(parseWorkflowOffset(undefined)).toBe(0)
    expect(parseWorkflowOffset('')).toBe(0)
    expect(parseWorkflowOffset('   ')).toBe(0)
    expect(parseWorkflowOffset('abc')).toBe(0)
  })

  it('clamps a hand-edited out-of-range param', () => {
    expect(parseWorkflowOffset('-10')).toBe(0)
    expect(parseWorkflowOffset('999999')).toBe(10_000)
  })

  it('takes the first value of a repeated param', () => {
    expect(parseWorkflowOffset(['60', '80'])).toBe(60)
  })
})

describe('offset pager helpers', () => {
  it('offers a next page only on a full page', () => {
    // No total and no envelope come back — a full page is the only signal.
    const paging = { limit: 20, offset: 0 }
    expect(hasNextWorkflowPage(20, paging)).toBe(true)
    expect(hasNextWorkflowPage(19, paging)).toBe(false)
    expect(hasNextWorkflowPage(0, paging)).toBe(false)
  })

  it('stops offering a next page at the offset ceiling', () => {
    expect(hasNextWorkflowPage(20, { limit: 20, offset: 10_000 })).toBe(false)
  })

  it('floors the previous offset at 0', () => {
    expect(previousWorkflowOffset({ limit: 20, offset: 40 })).toBe(20)
    expect(previousWorkflowOffset({ limit: 20, offset: 10 })).toBe(0)
    expect(previousWorkflowOffset({ limit: 20, offset: 0 })).toBe(0)
  })
})
