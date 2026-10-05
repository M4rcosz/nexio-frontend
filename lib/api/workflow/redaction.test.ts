import { describe, it, expect } from 'vitest'
import {
  REDACTED_MARKER,
  containsRedacted,
  isRedacted,
  stripRedacted,
} from './redaction'

const M = REDACTED_MARKER

describe('isRedacted', () => {
  it('matches only the exact marker', () => {
    expect(isRedacted(M)).toBe(true)
    expect(isRedacted(`Bearer ${M}`)).toBe(false)
    expect(isRedacted('***redacted***')).toBe(false)
    expect(isRedacted(null)).toBe(false)
    expect(isRedacted(undefined)).toBe(false)
  })
})

describe('stripRedacted', () => {
  it('omits a top-level entry whose value is the marker', () => {
    expect(stripRedacted({ name: 'notify kitchen', token: M })).toEqual({
      name: 'notify kitchen',
    })
  })

  it('omits a nested entry (headers.Authorization)', () => {
    expect(
      stripRedacted({
        url: 'https://api.example.com/notify',
        headers: { Authorization: M, 'content-type': 'application/json' },
      }),
    ).toEqual({
      url: 'https://api.example.com/notify',
      headers: { 'content-type': 'application/json' },
    })
  })

  it('drops a marker that is an ARRAY ELEMENT', () => {
    // The case §2.1's own snippet misses: `v.map(stripRedacted)` recurses but
    // never removes an element, so the marker survives and the write is refused.
    expect(stripRedacted({ headers: { 'X-Api-Key': [M] } })).toEqual({
      headers: { 'X-Api-Key': [] },
    })
    expect(stripRedacted({ keys: ['keep', M, 'also-keep'] })).toEqual({
      keys: ['keep', 'also-keep'],
    })
  })

  it('drops a marker nested inside an array of objects', () => {
    expect(
      stripRedacted([
        { id: 'call', headers: { Authorization: M } },
        { id: 'check', expression: 'total > 100' },
      ]),
    ).toEqual([
      { id: 'call', headers: {} },
      { id: 'check', expression: 'total > 100' },
    ])
  })

  it('keeps a marker EMBEDDED in a longer string', () => {
    // The service masks a whole value, never a fragment — so this is real user
    // input and removing it would silently delete what they typed.
    const input = { headers: { Authorization: `Bearer ${M}` } }
    expect(stripRedacted(input)).toEqual(input)
  })

  it('keeps the marker when it appears as an object KEY', () => {
    // Odd, but it is not a masked credential; dropping it would discard the
    // real value it holds.
    expect(stripRedacted({ [M]: 'real-value' })).toEqual({ [M]: 'real-value' })
  })

  it('handles scalars and empties without throwing', () => {
    expect(stripRedacted(null)).toBeNull()
    expect(stripRedacted(undefined)).toBeUndefined()
    expect(stripRedacted(42)).toBe(42)
    expect(stripRedacted(false)).toBe(false)
    expect(stripRedacted('plain')).toBe('plain')
    expect(stripRedacted({})).toEqual({})
    expect(stripRedacted([])).toEqual([])
  })

  it('returns undefined for a bare marker at the root', () => {
    // Nothing to remove it from — and returning it unchanged would break the
    // containsRedacted-after-strip invariant asserted below.
    expect(stripRedacted(M)).toBeUndefined()
  })

  it('does not mutate its input', () => {
    const input = { headers: { Authorization: M }, keys: [M, 'k'] }
    stripRedacted(input)
    expect(input).toEqual({ headers: { Authorization: M }, keys: [M, 'k'] })
  })

  it('leaves a clean object structurally unchanged', () => {
    const input = {
      name: 'notify kitchen',
      description: null,
      nodes: [{ id: 'call', url: 'https://x.test/a', config: {} }],
    }
    expect(stripRedacted(input)).toEqual(input)
  })
})

describe('containsRedacted', () => {
  const dirty: unknown[] = [
    M,
    { token: M },
    { headers: { Authorization: M } },
    { headers: { 'X-Api-Key': [M] } },
    [{ nodes: [{ headers: { Authorization: M } }] }],
  ]

  it('finds the marker at the root, nested, and inside arrays', () => {
    for (const value of dirty) expect(containsRedacted(value)).toBe(true)
  })

  it('is false once stripRedacted has run — for every case above', () => {
    for (const value of dirty) {
      expect(containsRedacted(stripRedacted(value))).toBe(false)
    }
  })

  it('is false for an embedded marker and for a marker used as a key', () => {
    expect(containsRedacted({ h: `Bearer ${M}` })).toBe(false)
    expect(containsRedacted({ [M]: 'real-value' })).toBe(false)
  })

  it('is false for clean and empty values', () => {
    expect(containsRedacted(null)).toBe(false)
    expect(containsRedacted(undefined)).toBe(false)
    expect(containsRedacted(0)).toBe(false)
    expect(containsRedacted({})).toBe(false)
    expect(containsRedacted([])).toBe(false)
    expect(containsRedacted({ a: { b: ['c', 1, null] } })).toBe(false)
  })
})
