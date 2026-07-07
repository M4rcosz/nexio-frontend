import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

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

vi.mock('@/lib/api/auth', () => ({ refreshBackend: vi.fn() }))

import { refreshBackend } from '@/lib/api/auth'
import { POST } from './route'

const mockedRefresh = vi.mocked(refreshBackend)

beforeEach(() => {
  vi.clearAllMocks()
  refreshCookie = undefined
})

describe('POST /api/auth/refresh', () => {
  it('rotates both cookies and answers 200 on a successful refresh', async () => {
    refreshCookie = 'rt-1'
    mockedRefresh.mockResolvedValue({ access_token: 'a1', refresh_token: 'r2' })

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockedRefresh).toHaveBeenCalledWith('rt-1')
    expect(res.cookies.get('nexio_session')?.value).toBe('a1')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('r2')
  })

  it('answers 401 and never calls the backend without a refresh cookie', async () => {
    const res = await POST()

    expect(res.status).toBe(401)
    expect(mockedRefresh).not.toHaveBeenCalled()
  })

  it('clears both cookies when the backend rejects the token (401)', async () => {
    refreshCookie = 'rt-bad'
    mockedRefresh.mockRejectedValue(new ApiError(401, null, 'invalid'))

    const res = await POST()

    expect(res.status).toBe(401)
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
    expect(res.cookies.get('nexio_session')?.maxAge).toBe(0)
  })

  it('clears both cookies when the backend revokes the token (403)', async () => {
    refreshCookie = 'rt-revoked'
    mockedRefresh.mockRejectedValue(new ApiError(403, null, 'revoked'))

    const res = await POST()

    expect(res.status).toBe(401)
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
    expect(res.cookies.get('nexio_session')?.maxAge).toBe(0)
  })

  it('treats an empty token pair as a failed refresh', async () => {
    refreshCookie = 'rt-1'
    mockedRefresh.mockResolvedValue({ access_token: '', refresh_token: '' })

    const res = await POST()

    expect(res.status).toBe(401)
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
  })
})
