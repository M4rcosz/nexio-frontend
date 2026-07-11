import { describe, it, expect } from 'vitest'
import { loginPasswordSchema, passwordSchema, scorePassword } from './password'

describe('scorePassword', () => {
  it('counts the character classes present', () => {
    expect(scorePassword('abcdefghij').classes).toBe(1) // lowercase only
    expect(scorePassword('abcABCdefg').classes).toBe(2) // + uppercase
    expect(scorePassword('abcABC1234').classes).toBe(3) // + digit
    expect(scorePassword('abcABC123!').classes).toBe(4) // + symbol
  })

  it('is valid only with ≥3 classes AND the length bound', () => {
    expect(scorePassword('abcABC1234').valid).toBe(true) // 10 chars, 3 classes
    expect(scorePassword('abcABC123').valid).toBe(false) // 9 chars, too short
    expect(scorePassword('abcdefghij').valid).toBe(false) // 1 class only
    expect(scorePassword('abcABcdefg').valid).toBe(false) // 2 classes only
    expect(scorePassword('aB1' + 'x'.repeat(126)).valid).toBe(false) // 129 chars
  })
})

describe('passwordSchema (strong)', () => {
  it('accepts a 3-of-4 password at the length bound', () => {
    expect(passwordSchema.safeParse('abcABC1234').success).toBe(true)
    expect(passwordSchema.safeParse('abcdef123!').success).toBe(true)
  })

  it('rejects fewer than 3 classes', () => {
    const res = passwordSchema.safeParse('abcdefghij')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues[0].message).toBe('complexity')
  })

  it('rejects below the minimum length', () => {
    const res = passwordSchema.safeParse('abcABC12')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues[0].message).toBe('too-short')
  })

  it('rejects above the maximum length', () => {
    const res = passwordSchema.safeParse('aB1' + 'x'.repeat(126))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues[0].message).toBe('too-long')
  })
})

describe('loginPasswordSchema (lenient)', () => {
  it('accepts 8+ chars with no complexity', () => {
    expect(loginPasswordSchema.safeParse('password').success).toBe(true)
  })

  it('rejects fewer than 8 chars', () => {
    expect(loginPasswordSchema.safeParse('short').success).toBe(false)
  })

  it('rejects above the maximum length', () => {
    expect(loginPasswordSchema.safeParse('x'.repeat(129)).success).toBe(false)
  })
})
