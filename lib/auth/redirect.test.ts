import { describe, it, expect } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('defaults to "/" for null/undefined/empty', () => {
    expect(safeRedirect(null)).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect('')).toBe('/')
  })

  it('allows a plain internal absolute path', () => {
    expect(safeRedirect('/admin')).toBe('/admin')
    expect(safeRedirect('/orders/o1?tab=payment')).toBe(
      '/orders/o1?tab=payment',
    )
  })

  it('rejects a target that is not an absolute path', () => {
    expect(safeRedirect('admin')).toBe('/')
    expect(safeRedirect('https://evil.com')).toBe('/')
  })

  it('rejects a protocol-relative "//host" open-redirect', () => {
    expect(safeRedirect('//evil.com')).toBe('/')
  })

  it('rejects a backslash trick that browsers normalize to "//"', () => {
    expect(safeRedirect('/\\evil.com')).toBe('/')
  })

  it('rejects control characters anywhere in the value', () => {
    expect(safeRedirect('/admin\n/evil')).toBe('/')
    expect(safeRedirect('/admin\x00')).toBe('/')
  })
})
