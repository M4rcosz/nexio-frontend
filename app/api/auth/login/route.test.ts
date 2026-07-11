import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/api/auth', () => ({ loginBackend: vi.fn() }))

import { loginBackend } from '@/lib/api/auth'
import { POST } from './route'

const mockedLogin = vi.mocked(loginBackend)

/** Builds a JWT-shaped token whose payload carries the given claims. */
function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

function loginReq(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/login', () => {
  it('sets both cookies and returns the role on success', async () => {
    mockedLogin.mockResolvedValue({
      access_token: makeToken({ role: 'ADMIN' }),
      refresh_token: 'r1',
    })

    const res = await POST(
      loginReq({ username: 'admin', password: 'secret12' }),
    )

    expect(res.status).toBe(200)
    expect(res.cookies.get('nexio_session')?.value).toBeTruthy()
    expect(res.cookies.get('nexio_refresh')?.value).toBe('r1')
    expect(await res.json()).toMatchObject({ ok: true, role: 'ADMIN' })
  })

  it('answers 502 and sets no cookie when the refresh token is empty', async () => {
    mockedLogin.mockResolvedValue({ access_token: 'a1', refresh_token: '' })

    const res = await POST(
      loginReq({ username: 'admin', password: 'secret12' }),
    )

    expect(res.status).toBe(502)
    expect(res.cookies.get('nexio_session')).toBeUndefined()
    expect(res.cookies.get('nexio_refresh')).toBeUndefined()
  })

  it('answers 502 and sets no cookie when the access token is empty', async () => {
    mockedLogin.mockResolvedValue({ access_token: '', refresh_token: 'r1' })

    const res = await POST(
      loginReq({ username: 'admin', password: 'secret12' }),
    )

    expect(res.status).toBe(502)
    expect(res.cookies.get('nexio_session')).toBeUndefined()
  })

  it('maps a backend 401 to invalid_credentials', async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, null, 'nope'))

    const res = await POST(
      loginReq({ username: 'admin', password: 'wrongpass' }),
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'invalid_credentials' })
  })
})
