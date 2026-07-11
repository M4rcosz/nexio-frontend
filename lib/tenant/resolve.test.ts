import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mutable holder read by the mocked headers() store, set per-test. When set to
// the throw sentinel, headers() rejects (simulating a static context).
let hostHeader: string | undefined
let headersThrows = false

vi.mock('next/headers', () => ({
  headers: async () => {
    if (headersThrows) throw new Error('headers() unavailable')
    return {
      get: (name: string) =>
        name === 'host' && hostHeader !== undefined ? hostHeader : null,
    }
  },
}))

import { getTenant } from './resolve'

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_TENANT

beforeEach(() => {
  hostHeader = undefined
  headersThrows = false
  delete process.env.NEXT_PUBLIC_TENANT
})

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_TENANT
  else process.env.NEXT_PUBLIC_TENANT = ORIGINAL_ENV
})

describe('getTenant', () => {
  it('resolves the tenant from a known subdomain (highest priority)', async () => {
    hostHeader = 'sertao.app.com'
    process.env.NEXT_PUBLIC_TENANT = 'nexio' // subdomain must win over env
    const tenant = await getTenant()
    expect(tenant.id).toBe('sertao')
  })

  it('handles a subdomain with a port', async () => {
    hostHeader = 'sertao.localhost:3000'
    const tenant = await getTenant()
    expect(tenant.id).toBe('sertao')
  })

  it('falls back to NEXT_PUBLIC_TENANT when the subdomain is unknown', async () => {
    hostHeader = 'www.app.com'
    process.env.NEXT_PUBLIC_TENANT = 'sertao'
    const tenant = await getTenant()
    expect(tenant.id).toBe('sertao')
  })

  it('falls back to the default tenant when nothing matches', async () => {
    hostHeader = 'www.app.com'
    const tenant = await getTenant()
    expect(tenant.id).toBe('nexio')
  })

  it('falls through to env/default when headers() is unavailable (static context)', async () => {
    headersThrows = true
    process.env.NEXT_PUBLIC_TENANT = 'sertao'
    const tenant = await getTenant()
    expect(tenant.id).toBe('sertao')
  })
})
