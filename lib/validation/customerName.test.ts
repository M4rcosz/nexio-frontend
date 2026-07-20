import { describe, it, expect } from 'vitest'
import {
  CUSTOMER_NAME_MAX_LENGTH,
  normalizeCustomerName,
  checkCustomerName,
  isValidCustomerName,
  customerNameSchema,
} from './customerName'

describe('normalizeCustomerName', () => {
  it('strips zero-width space and BOM, then trims', () => {
    expect(normalizeCustomerName('  Maria​  ')).toBe('Maria')
    expect(normalizeCustomerName('﻿Ana﻿')).toBe('Ana')
  })
})

describe('checkCustomerName', () => {
  it('accepts normal and accented names', () => {
    expect(checkCustomerName('Maria')).toBeNull()
    expect(checkCustomerName('José')).toBeNull()
    expect(checkCustomerName('Ana Sofía')).toBeNull()
    expect(checkCustomerName('Seu Antonio')).toBeNull()
  })

  it('treats whitespace, zero-width and punctuation-only as absent', () => {
    expect(checkCustomerName('   ')).toBe('required')
    expect(checkCustomerName('​')).toBe('required')
    expect(checkCustomerName('!!!')).toBe('required')
    expect(checkCustomerName('')).toBe('required')
  })

  it('accepts a digit as the only alphanumeric', () => {
    expect(checkCustomerName('Table 12')).toBeNull()
    expect(checkCustomerName('7')).toBeNull()
  })

  it('rejects names longer than the max (trimmed)', () => {
    expect(checkCustomerName('a'.repeat(CUSTOMER_NAME_MAX_LENGTH))).toBeNull()
    expect(checkCustomerName('a'.repeat(CUSTOMER_NAME_MAX_LENGTH + 1))).toBe(
      'too-long',
    )
    // Surrounding whitespace does not count toward the length.
    expect(
      checkCustomerName(`  ${'a'.repeat(CUSTOMER_NAME_MAX_LENGTH)}  `),
    ).toBeNull()
  })
})

describe('isValidCustomerName', () => {
  it('reflects checkCustomerName', () => {
    expect(isValidCustomerName('Maria')).toBe(true)
    expect(isValidCustomerName('   ')).toBe(false)
  })
})

describe('customerNameSchema', () => {
  it('trims and accepts a valid name', () => {
    expect(customerNameSchema.parse('  Maria  ')).toBe('Maria')
  })

  it('rejects blank and over-long names with the rule keys', () => {
    const blank = customerNameSchema.safeParse('   ')
    expect(blank.success).toBe(false)
    if (!blank.success) {
      expect(blank.error.issues[0].message).toBe('required')
    }
    const long = customerNameSchema.safeParse('a'.repeat(61))
    expect(long.success).toBe(false)
    if (!long.success) {
      expect(long.error.issues[0].message).toBe('too-long')
    }
  })
})
