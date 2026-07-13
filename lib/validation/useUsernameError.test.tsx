// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHookWithIntl } from '@/lib/test/intl'
import { useUsernameError } from './useUsernameError'

describe('useUsernameError', () => {
  it('returns null for an empty value (no error while pristine)', () => {
    const { result } = renderHookWithIntl(() => useUsernameError())
    expect(result.current('')).toBeNull()
  })

  it('returns null for a valid username', () => {
    const { result } = renderHookWithIntl(() => useUsernameError())
    expect(result.current('janedoe')).toBeNull()
  })

  it('translates the too-short rule', () => {
    const { result } = renderHookWithIntl(() => useUsernameError())
    expect(result.current('ab')).toMatch(/too short/i)
  })

  it('translates the pattern rule for uppercase input', () => {
    const { result } = renderHookWithIntl(() => useUsernameError())
    expect(result.current('JaneDoe')).toMatch(/lowercase/i)
  })

  it('translates the reserved rule', () => {
    const { result } = renderHookWithIntl(() => useUsernameError())
    expect(result.current('admin')).toMatch(/reserved/i)
  })
})
