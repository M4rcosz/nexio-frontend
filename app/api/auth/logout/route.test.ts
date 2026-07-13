import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable holder read by the mocked cookies() store, set per-test.
let refreshCookie: string | undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'nexio_refresh' && refreshCookie !== undefined
        ? { value: refreshCookie }
        : undefined,
  }),
}))

vi.mock('@/lib/api/auth', () => ({ logoutBackend: vi.fn() }))

import { logoutBackend } from '@/lib/api/auth'
import { POST } from './route'

const mockedLogout = vi.mocked(logoutBackend)

beforeEach(() => {
  vi.clearAllMocks()
  refreshCookie = undefined
})

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and clears both cookies', async () => {
    refreshCookie = 'rt-1'
    mockedLogout.mockResolvedValue(undefined)
    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockedLogout).toHaveBeenCalledWith('rt-1')
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
    expect(res.cookies.get('nexio_session')?.maxAge).toBe(0)
  })

  it('clears cookies without calling the backend when there is no refresh token', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockedLogout).not.toHaveBeenCalled()
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
  })

  it('still clears cookies when the backend revocation fails (best-effort)', async () => {
    refreshCookie = 'rt-bad'
    mockedLogout.mockRejectedValue(new Error('network down'))
    const res = await POST()
    expect(res.status).toBe(200)
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
  })
})
