import { describe, it, expect, vi, beforeEach } from 'vitest'

// A mutable holder the mocked cookies() reads from, set per-test.
let cookieValue: string | undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookieValue === undefined ? undefined : { value: cookieValue }),
  }),
}))

import { getSession, isAuthenticated } from './session'

/** Builds a JWT-shaped `header.payload.signature` with a base64url payload. */
function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

describe('getSession', () => {
  beforeEach(() => {
    cookieValue = undefined
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
    })
    const session = await getSession()
    expect(session).toMatchObject({
      sub: 'u1',
      username: 'admin',
      role: 'ADMIN',
      businessUnitIds: ['bu-1'],
    })
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

describe('isAuthenticated', () => {
  beforeEach(() => {
    cookieValue = undefined
  })

  it('is false without a session', async () => {
    expect(await isAuthenticated()).toBe(false)
  })

  it('is true with a valid session', async () => {
    cookieValue = makeToken({ sub: 'u1', username: 'a', role: 'CUSTOMER' })
    expect(await isAuthenticated()).toBe(true)
  })
})
