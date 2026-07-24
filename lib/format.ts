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
