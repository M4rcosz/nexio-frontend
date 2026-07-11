import { describe, it, expect } from 'vitest'
import { cnpjDigits, maskCnpj, formatDateTime } from './format'

describe('cnpjDigits', () => {
  it('strips every non-digit', () => {
    expect(cnpjDigits('12.345.678/0001-99')).toBe('12345678000199')
  })

  it('caps at 14 digits', () => {
    expect(cnpjDigits('123456789012345678')).toBe('12345678901234')
  })

  it('returns empty string for input without digits', () => {
    expect(cnpjDigits('abc-/.')).toBe('')
  })
})

describe('maskCnpj', () => {
  it('masks a full raw CNPJ', () => {
    expect(maskCnpj('12345678000199')).toBe('12.345.678/0001-99')
  })

  it('masks a partial CNPJ progressively', () => {
    expect(maskCnpj('12')).toBe('12')
    expect(maskCnpj('123')).toBe('12.3')
    expect(maskCnpj('123456')).toBe('12.345.6')
    expect(maskCnpj('12345678')).toBe('12.345.678')
    expect(maskCnpj('123456780001')).toBe('12.345.678/0001')
  })

  it('is idempotent on already-masked input', () => {
    expect(maskCnpj('12.345.678/0001-99')).toBe('12.345.678/0001-99')
  })
})

describe('formatDateTime', () => {
  it('formats a valid ISO string', () => {
    const out = formatDateTime('2026-07-06T15:30:00Z', 'en')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string that contains digits', () => {
    const out = formatDateTime('2026-01-02T03:04:00Z', 'en')
    expect(out).toMatch(/\d/)
  })

  it('returns "Invalid Date" for an unparseable ISO (toLocaleString does not throw)', () => {
    // new Date('not-a-date') yields Invalid Date; toLocaleString returns
    // "Invalid Date" rather than throwing, so the catch branch is never hit.
    expect(formatDateTime('not-a-date', 'en')).toBe('Invalid Date')
  })

  it('falls back to the raw ISO when the locale is invalid (catch branch)', () => {
    // An invalid BCP47 locale makes toLocaleString throw a RangeError, which the
    // catch swallows by returning the original input untouched.
    expect(formatDateTime('2026-07-06T15:30:00Z', '!!invalid')).toBe(
      '2026-07-06T15:30:00Z',
    )
  })
})
