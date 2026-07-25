import type { OrderStatus } from './api/types'

export const ORDER_STATUS_TIMELINE: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
]

/** Strips every non-digit and caps at the 14 digits of a CNPJ. */
export function cnpjDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14)
}

/**
 * Formats a CNPJ (full or partial) as `XX.XXX.XXX/XXXX-XX`. Accepts masked or
 * raw input and is safe to run on every keystroke.
 */
export function maskCnpj(value: string): string {
  const d = cnpjDigits(value)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += `.${d.slice(2, 5)}`
  if (d.length >= 6) out += `.${d.slice(5, 8)}`
  if (d.length >= 9) out += `/${d.slice(8, 12)}`
  if (d.length >= 13) out += `-${d.slice(12, 14)}`
  return out
}

export function formatDateTime(iso: string, locale: string = 'en'): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Past this age a count of days stops being useful ("412 d ago"), so callers
 *  fall back to the absolute date. */
const RELATIVE_MAX_DAYS = 30

/**
 * "now" → "5 min. ago" → "3 hr. ago" → "2 days ago", localized by `Intl`.
 *
 * Escalates one unit at a time and stops at days: past {@link RELATIVE_MAX_DAYS}
 * it returns the absolute {@link formatDateTime} instead, since a day count
 * that large reads as noise.
 *
 * `now` is a parameter rather than a `Date.now()` call inside so the value can
 * be driven by a ticking clock in the UI (and pinned in tests) — the function
 * itself stays pure.
 */
export function formatRelativeTime(
  iso: string,
  locale: string = 'en',
  now: number = Date.now(),
): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  try {
    // Clamp: a clock skew that puts the stored instant slightly in the future
    // must read as "now", never "in 3 minutes".
    const seconds = Math.max(0, Math.floor((now - then) / 1000))
    // `numeric: 'always'` on purpose: 'auto' swaps in calendar words
    // ("yesterday", pt-BR "anteontem") for -1/-2 days, and these buckets are
    // elapsed time, not calendar days — 30 hours ago can be two dates back.
    const rtf = new Intl.RelativeTimeFormat(locale, {
      numeric: 'always',
      style: 'short',
    })
    // The one place 'auto' is right: it renders zero as "now"/"agora" instead
    // of "in 0 seconds".
    if (seconds < 60)
      return new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        style: 'short',
      }).format(0, 'second')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    const days = Math.floor(hours / 24)
    if (days <= RELATIVE_MAX_DAYS) return rtf.format(-days, 'day')
    return formatDateTime(iso, locale)
  } catch {
    return formatDateTime(iso, locale)
  }
}

/** Long-form day, for the heading of a timeline group. */
export function formatDateLabel(iso: string, locale: string = 'en'): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatTime(iso: string, locale: string = 'en'): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Local calendar day of an instant, as `YYYY-MM-DD` — the grouping key for a
 * day-by-day timeline. Local (not UTC) so a late-evening order groups under the
 * day the customer placed it on.
 */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}
