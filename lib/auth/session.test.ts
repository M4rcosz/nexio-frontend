import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable holders the mocked cookies() reads from, set per-test. The getter is
// name-aware so tests can drive the session and refresh cookies independently.
let cookieValue: string | undefined
let refreshValue: string | undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name?: string) => {
      if (name === 'nexio_refresh') {
        return refreshValue === undefined ? undefined : { value: refreshValue }
      }
      return cookieValue === undefined ? undefined : { value: cookieValue }
    },
  }),
}))

import {
  getSession,
  isAuthenticated,
  isTokenExpired,
  hasActiveOrRefreshableSession,
} from './session'

/** Builds a JWT-shaped `header.payload.signature` with a base64url payload. */
function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

describe('getSession', () => {
  beforeEach(() => {
    cookieValue = undefined
    refreshValue = undefined
  })

  it('returns null when no cookie is present', async () => {
    cookieValue = undefined
    expect(await getSession()).toBeNull()
  })

  it('decodes a valid token payload', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'admin',
      role: 'ADMIN',
      businessUnitIds: ['bu-1'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    const session = await getSession()
    expect(session).toMatchObject({
      sub: 'u1',
      username: 'admin',
      role: 'ADMIN',
      businessUnitIds: ['bu-1'],
    })
  })

  it('decodes a unicode payload via the edge-safe base64url decoder', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'joão café',
      role: 'CUSTOMER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    const session = await getSession()
    expect(session?.username).toBe('joão café')
  })

  it('returns null for a token without an exp claim (unverifiable)', async () => {
    cookieValue = makeToken({ sub: 'u1', username: 'admin', role: 'ADMIN' })
    expect(await getSession()).toBeNull()
  })

  it('returns null for a malformed token (no payload segment)', async () => {
    cookieValue = 'garbage-without-dots'
    expect(await getSession()).toBeNull()
  })

  it('returns null when the payload is not valid JSON', async () => {
    cookieValue = `header.${Buffer.from('not-json').toString('base64url')}.sig`
    expect(await getSession()).toBeNull()
  })

  it('returns null for an expired token', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'admin',
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) - 60,
    })
    expect(await getSession()).toBeNull()
  })

  it('accepts a token whose exp is still in the future', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'admin',
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    expect(await getSession()).not.toBeNull()
  })
})

describe('isTokenExpired', () => {
  it('is false for a token whose exp is comfortably in the future', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isTokenExpired(token)).toBe(false)
  })

  it('is true for a token whose exp is in the past', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('is true within the default skew window (renews early)', () => {
    // exp is 10s ahead but the 30s skew treats it as already expired.
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 10 })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('is true when no token is provided', () => {
    expect(isTokenExpired(undefined)).toBe(true)
  })

  it('is true for a malformed token', () => {
    expect(isTokenExpired('garbage-without-dots')).toBe(true)
  })

  it('is true when the payload carries no exp claim', () => {
    const token = makeToken({ sub: 'u1', role: 'ADMIN' })
    expect(isTokenExpired(token)).toBe(true)
  })
})

describe('isAuthenticated', () => {
  beforeEach(() => {
    cookieValue = undefined
    refreshValue = undefined
  })

  it('is false without a session', async () => {
    expect(await isAuthenticated()).toBe(false)
  })

  it('is true with a valid session', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'a',
      role: 'CUSTOMER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    expect(await isAuthenticated()).toBe(true)
  })
})

describe('hasActiveOrRefreshableSession', () => {
  const future = () => Math.floor(Date.now() / 1000) + 3600
  const past = () => Math.floor(Date.now() / 1000) - 60

  beforeEach(() => {
    cookieValue = undefined
    refreshValue = undefined
  })

  it('is true for a still-valid session', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'a',
      role: 'CUSTOMER',
      exp: future(),
    })
    expect(await hasActiveOrRefreshableSession()).toBe(true)
  })

  it('is true when the session is expired but a refresh cookie exists', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'a',
      role: 'CUSTOMER',
      exp: past(),
    })
    refreshValue = 'rt-1'
    expect(await hasActiveOrRefreshableSession()).toBe(true)
  })

  it('is true with no session at all but a refresh cookie present', async () => {
    refreshValue = 'rt-1'
    expect(await hasActiveOrRefreshableSession()).toBe(true)
  })

  it('is false when the session is expired and there is no refresh cookie', async () => {
    cookieValue = makeToken({
      sub: 'u1',
      username: 'a',
      role: 'CUSTOMER',
      exp: past(),
    })
    expect(await hasActiveOrRefreshableSession()).toBe(false)
  })

  it('is false when neither a session nor a refresh cookie exists', async () => {
    expect(await hasActiveOrRefreshableSession()).toBe(false)
  })
})
