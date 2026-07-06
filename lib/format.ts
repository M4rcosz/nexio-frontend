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
