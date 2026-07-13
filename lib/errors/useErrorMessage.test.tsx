// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHookWithIntl } from '@/lib/test/intl'
import { useErrorMessage } from './useErrorMessage'

describe('useErrorMessage', () => {
  it('prefers an explicit machine code when the catalog has it', () => {
    const { result } = renderHookWithIntl(() => useErrorMessage())
    expect(result.current('invalid_credentials', 401)).toMatch(
      /incorrect username or password/i,
    )
  })

  it('falls back to a status-derived code when no code is given', () => {
    const { result } = renderHookWithIntl(() => useErrorMessage())
    expect(result.current(undefined, 403)).toMatch(/permission/i)
    expect(result.current(null, 404)).toMatch(/couldn't find/i)
    expect(result.current(undefined, 409)).toMatch(/conflicts/i)
  })

  it('maps any 5xx to the generic server message', () => {
    const { result } = renderHookWithIntl(() => useErrorMessage())
    expect(result.current(undefined, 500)).toMatch(/unavailable/i)
    expect(result.current(undefined, 503)).toMatch(/unavailable/i)
  })

  it('returns null when nothing specific applies (e.g. a bare 400)', () => {
    const { result } = renderHookWithIntl(() => useErrorMessage())
    expect(result.current(undefined, 400)).toBeNull()
    expect(result.current()).toBeNull()
  })

  it('ignores an unknown code and uses the status fallback instead', () => {
    const { result } = renderHookWithIntl(() => useErrorMessage())
    expect(result.current('totally_made_up', 401)).toMatch(
      /session has expired/i,
    )
  })
})
