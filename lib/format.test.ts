import { describe, it, expect } from 'vitest'
import {
  cnpjDigits,
  dayKey,
  maskCnpj,
  formatDateLabel,
  formatDateTime,
  formatRelativeTime,
  formatTime,
} from './format'

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

describe('formatDateLabel', () => {
  it('formats the day without a time part', () => {
    const out = formatDateLabel('2026-07-06T15:30:00Z', 'en')
    expect(out).toMatch(/Jul/)
    expect(out).toMatch(/2026/)
    expect(out).not.toMatch(/:/)
  })

  it('falls back to the raw ISO when the locale is invalid', () => {
    expect(formatDateLabel('2026-07-06T15:30:00Z', '!!invalid')).toBe(
      '2026-07-06T15:30:00Z',
    )
  })
})

describe('formatTime', () => {
  it('formats only hour and minute', () => {
    expect(formatTime('2026-07-06T15:30:00Z', 'en')).toMatch(/\d{1,2}:\d{2}/)
  })

  it('falls back to the raw ISO when the locale is invalid', () => {
    expect(formatTime('2026-07-06T15:30:00Z', '!!invalid')).toBe(
      '2026-07-06T15:30:00Z',
    )
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-24T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR

  it('reads as "now" below a minute', () => {
    expect(formatRelativeTime(ago(0), 'en', now)).toBe('now')
    expect(formatRelativeTime(ago(59_000), 'en', now)).toBe('now')
  })

  it('escalates minutes to hours to days', () => {
    expect(formatRelativeTime(ago(MINUTE), 'en', now)).toBe('1 min. ago')
    expect(formatRelativeTime(ago(59 * MINUTE), 'en', now)).toBe('59 min. ago')
    expect(formatRelativeTime(ago(HOUR), 'en', now)).toBe('1 hr. ago')
    expect(formatRelativeTime(ago(23 * HOUR), 'en', now)).toBe('23 hr. ago')
    expect(formatRelativeTime(ago(DAY), 'en', now)).toBe('1 day ago')
    expect(formatRelativeTime(ago(30 * DAY), 'en', now)).toBe('30 days ago')
  })

  it('truncates rather than rounds, so a label never runs ahead', () => {
    expect(formatRelativeTime(ago(119_000), 'en', now)).toBe('1 min. ago')
  })

  it('never counts calendar days — 30 hours is one elapsed day, not "yesterday"', () => {
    expect(formatRelativeTime(ago(30 * HOUR), 'en', now)).toBe('1 day ago')
  })

  it('localizes the unit', () => {
    expect(formatRelativeTime(ago(5 * MINUTE), 'pt-BR', now)).toBe('há 5 min.')
  })

  it('falls back to the absolute stamp past a month of days', () => {
    expect(formatRelativeTime(ago(31 * DAY), 'en', now)).toBe(
      formatDateTime(ago(31 * DAY), 'en'),
    )
  })

  it('clamps a future instant to "now" instead of counting up', () => {
    expect(
      formatRelativeTime(new Date(now + 3 * MINUTE).toISOString(), 'en', now),
    ).toBe('now')
  })

  it('returns the raw input for an unparseable date', () => {
    expect(formatRelativeTime('not-a-date', 'en', now)).toBe('not-a-date')
  })
})

describe('dayKey', () => {
  it('keys two instants on the same local day identically', () => {
    const a = new Date(2026, 6, 6, 0, 5).toISOString()
    const b = new Date(2026, 6, 6, 23, 55).toISOString()
    expect(dayKey(a)).toBe(dayKey(b))
    expect(dayKey(a)).toBe('2026-07-06')
  })

  it('separates adjacent local days', () => {
    const a = new Date(2026, 6, 6, 23, 55).toISOString()
    const b = new Date(2026, 6, 7, 0, 5).toISOString()
    expect(dayKey(a)).not.toBe(dayKey(b))
  })

  it('returns the raw input for an unparseable date', () => {
    expect(dayKey('not-a-date')).toBe('not-a-date')
  })
})
