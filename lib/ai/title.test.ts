import { describe, it, expect } from 'vitest'
import { deriveTitle, isValidTitle, normalizeTitle, titleLength } from './title'
import { CONVERSATION_TITLE_MAX_LENGTH } from '@/lib/validation/constants'

describe('titleLength', () => {
  it('counts code points, not UTF-16 units', () => {
    // A cactus emoji is a surrogate pair: `.length` reads 2, `[...]` reads 1.
    expect('🌵'.length).toBe(2)
    expect(titleLength('🌵')).toBe(1)
    expect(titleLength('🌵'.repeat(80))).toBe(80)
  })
})

describe('isValidTitle', () => {
  it('accepts 80 code points of emoji but rejects 81', () => {
    expect(isValidTitle('🌵'.repeat(80))).toBe(true)
    expect(isValidTitle('🌵'.repeat(81))).toBe(false)
  })

  it('rejects blank / whitespace-only', () => {
    expect(isValidTitle('')).toBe(false)
    expect(isValidTitle('   ')).toBe(false)
    expect(isValidTitle('\n\t ')).toBe(false)
  })

  it('accepts a plain short title', () => {
    expect(isValidTitle('Where is my order?')).toBe(true)
  })
})

describe('normalizeTitle', () => {
  it('trims and collapses tabs, newlines and multi-space runs', () => {
    expect(normalizeTitle('  hello\t\tworld\n\nagain   ')).toBe(
      'hello world again',
    )
  })
})

describe('deriveTitle', () => {
  it('leaves an already-short message untouched (no ellipsis)', () => {
    expect(deriveTitle('Where is my order?')).toBe('Where is my order?')
    expect(deriveTitle('Where is my order?')).not.toContain('...')
  })

  it('collapses internal whitespace runs', () => {
    expect(deriveTitle('hello\tthere\n\nfriend')).toBe('hello there friend')
  })

  it('falls back to "New conversation" for a pure-whitespace opener', () => {
    expect(deriveTitle('   \n\t  ')).toBe('New conversation')
    expect(deriveTitle('')).toBe('New conversation')
  })

  it('cuts on a word boundary and appends "..." when truncated', () => {
    const words = 'lorem '.repeat(30).trim() // many short words, well over 80
    const out = deriveTitle(words)
    expect(out.endsWith('...')).toBe(true)
    // The visible body cut at a space — no partial "lore" word before the dots.
    const body = out.slice(0, -3)
    expect(body.endsWith(' ')).toBe(false)
    expect(body).toMatch(/lorem$/)
    // The FULL result (body + ellipsis) fits the cap, so it stays valid.
    expect(titleLength(out)).toBeLessThanOrEqual(CONVERSATION_TITLE_MAX_LENGTH)
    expect(isValidTitle(out)).toBe(true)
  })

  it('hard-cuts a single over-long word, ellipsis included, within the cap', () => {
    const word = 'a'.repeat(200)
    const out = deriveTitle(word)
    expect(out.endsWith('...')).toBe(true)
    // Content reserves room for the "..." → 77 + 3 = 80, still valid.
    expect(titleLength(out.slice(0, -3))).toBe(
      CONVERSATION_TITLE_MAX_LENGTH - 3,
    )
    expect(titleLength(out)).toBe(CONVERSATION_TITLE_MAX_LENGTH)
    expect(isValidTitle(out)).toBe(true)
  })

  it('hard-cuts an over-long emoji word by code point, never mid-surrogate', () => {
    const out = deriveTitle('🌵'.repeat(200))
    const body = out.slice(0, -3)
    expect(out.endsWith('...')).toBe(true)
    expect(titleLength(body)).toBe(CONVERSATION_TITLE_MAX_LENGTH - 3)
    expect(titleLength(out)).toBe(CONVERSATION_TITLE_MAX_LENGTH)
    // Body is only whole cacti — no lone surrogate half.
    expect([...body].every((c) => c === '🌵')).toBe(true)
    expect(isValidTitle(out)).toBe(true)
  })

  it('always derives a title that passes isValidTitle, for any input', () => {
    for (const input of [
      '',
      '   \n\t ',
      'short',
      'x'.repeat(CONVERSATION_TITLE_MAX_LENGTH),
      'a'.repeat(500),
      '🌵'.repeat(500),
      'lorem '.repeat(100),
      `${'word '.repeat(15)}${'z'.repeat(120)}`,
    ]) {
      const out = deriveTitle(input)
      expect(titleLength(out)).toBeLessThanOrEqual(
        CONVERSATION_TITLE_MAX_LENGTH,
      )
      expect(isValidTitle(out)).toBe(true)
    }
  })

  it('does not append "..." when the message is exactly at the limit', () => {
    const exact = 'x'.repeat(CONVERSATION_TITLE_MAX_LENGTH)
    expect(deriveTitle(exact)).toBe(exact)
  })
})
