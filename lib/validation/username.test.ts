import { describe, it, expect } from 'vitest'
import { checkUsername, loginUsernameSchema, usernameSchema } from './username'

describe('usernameSchema (strict)', () => {
  it('accepts valid usernames', () => {
    for (const v of [
      'joao.silva',
      'joao_silva',
      'joao-silva',
      'joao123',
      'admin.joao',
      'abc',
    ]) {
      expect(usernameSchema.safeParse(v).success, v).toBe(true)
    }
  })

  it('rejects reserved usernames (exact match) with the reserved rule', () => {
    // Only reserved words of valid length reach the reserved refine — a short
    // one like "me" is (correctly) rejected earlier by the length rule.
    for (const v of [
      'admin',
      'root',
      'users',
      'undefined',
      'null',
      'administrator',
    ]) {
      const res = usernameSchema.safeParse(v)
      expect(res.success, v).toBe(false)
      if (!res.success) {
        expect(res.error.issues[0].message).toBe('reserved')
      }
    }
  })

  it('still rejects a short reserved word (via the length rule)', () => {
    expect(usernameSchema.safeParse('me').success).toBe(false)
  })

  it('rejects uppercase via the pattern (not folded, not treated as reserved)', () => {
    const res = usernameSchema.safeParse('Admin')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('pattern')
    }
  })

  it('rejects a leading or trailing non-alphanumeric', () => {
    for (const v of ['.joao', 'joao.', '-joao', 'joao-', '_joao', 'joao_']) {
      expect(usernameSchema.safeParse(v).success, v).toBe(false)
    }
  })

  it('rejects whitespace', () => {
    for (const v of ['joao silva', ' joao', 'joao ', 'jo\tao']) {
      expect(usernameSchema.safeParse(v).success, v).toBe(false)
    }
  })

  it('rejects too-short and too-long', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false)
    expect(usernameSchema.safeParse('a'.repeat(51)).success).toBe(false)
    expect(usernameSchema.safeParse('a'.repeat(50)).success).toBe(true)
  })
})

describe('checkUsername (instant feedback helper)', () => {
  it('returns null for valid values', () => {
    expect(checkUsername('joao.silva')).toBeNull()
  })

  it('reports the first failing rule in order', () => {
    expect(checkUsername('ab')).toBe('too-short')
    expect(checkUsername('a'.repeat(51))).toBe('too-long')
    expect(checkUsername('Admin')).toBe('pattern')
    expect(checkUsername('.joao')).toBe('pattern')
    expect(checkUsername('admin')).toBe('reserved')
  })
})

describe('loginUsernameSchema (lenient)', () => {
  it('trims and accepts anything within the length bound', () => {
    expect(loginUsernameSchema.parse('  Admin  ')).toBe('Admin')
    expect(loginUsernameSchema.safeParse('reserved.but.ok').success).toBe(true)
    expect(loginUsernameSchema.safeParse('UPPER').success).toBe(true)
  })

  it('rejects an empty (or whitespace-only) username', () => {
    expect(loginUsernameSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects an over-long username', () => {
    expect(loginUsernameSchema.safeParse('a'.repeat(257)).success).toBe(false)
  })
})
