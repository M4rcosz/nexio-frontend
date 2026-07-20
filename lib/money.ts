import Big from 'big.js'

export type Money = Big

/** 1 loyalty point = R$0.10 discount. Mirrors the backend redemption rule. */
export const LOYALTY_POINT_VALUE = '0.10'

export function asMoney(v: string | number | Big): Big {
  if (v instanceof Big) return v
  return new Big(v)
}

const formatters = new Map<string, Intl.NumberFormat>()

function getFormatter(locale: string): Intl.NumberFormat {
  let f = formatters.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'BRL',
    })
    formatters.set(locale, f)
  }
  return f
}

/**
 * Format a Money value as Brazilian Real. The Real stays as the only currency
 * (we sell in Brazil), but the locale changes the visual format:
 *   - 'pt-BR' → "R$ 58,90"
 *   - 'en'    → "R$58.90"
 */
export function formatMoney(
  v: Big | string | number,
  locale: string = 'en',
): string {
  const big = v instanceof Big ? v : new Big(v)
  return getFormatter(locale).format(Number(big.toFixed(2)))
}

/** @deprecated use formatMoney(v, locale) */
export function formatBRL(v: Big | string | number): string {
  return formatMoney(v, 'pt-BR')
}

export function multiplyMoney(price: string | number | Big, qty: number): Big {
  return asMoney(price).times(qty)
}

export function sumMoney(values: Array<string | number | Big>): Big {
  return values.reduce<Big>((acc, v) => acc.plus(asMoney(v)), new Big(0))
}
