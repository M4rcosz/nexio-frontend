import { describe, it, expect } from 'vitest'
import Big from 'big.js'
import {
  asMoney,
  formatMoney,
  formatBRL,
  multiplyMoney,
  sumMoney,
} from './money'

describe('asMoney', () => {
  it('returns the same Big instance when given a Big', () => {
    const b = new Big('10.50')
    expect(asMoney(b)).toBe(b)
  })

  it('coerces strings and numbers to Big', () => {
    expect(asMoney('10.50').eq(new Big('10.50'))).toBe(true)
    expect(asMoney(3).eq(new Big(3))).toBe(true)
  })
})

describe('formatMoney', () => {
  it('formats with the en locale by default', () => {
    // en: no space between symbol and number, dot decimal separator.
    expect(formatMoney('58.90')).toBe('R$58.90')
  })

  it('formats with the pt-BR locale', () => {
    const out = formatMoney('58.90', 'pt-BR')
    expect(out).toContain('R$')
    expect(out).toContain('58,90')
  })

  it('rounds to two decimal places', () => {
    expect(formatMoney('1.005', 'en')).toBe('R$1.01')
  })

  it('accepts Big and number inputs', () => {
    expect(formatMoney(new Big('12.30'), 'en')).toBe('R$12.30')
    expect(formatMoney(12.3, 'en')).toBe('R$12.30')
  })
})

describe('formatBRL', () => {
  it('is the pt-BR variant of formatMoney', () => {
    expect(formatBRL('58.90')).toBe(formatMoney('58.90', 'pt-BR'))
  })
})

describe('multiplyMoney', () => {
  it('multiplies a price by a quantity', () => {
    expect(multiplyMoney('10.50', 3).eq(new Big('31.50'))).toBe(true)
  })
})

describe('sumMoney', () => {
  it('sums an array of mixed money values', () => {
    expect(sumMoney(['10.50', 5, new Big('0.50')]).eq(new Big('16'))).toBe(true)
  })

  it('returns zero for an empty array', () => {
    expect(sumMoney([]).eq(new Big(0))).toBe(true)
  })
})
