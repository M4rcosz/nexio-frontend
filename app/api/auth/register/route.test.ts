import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/api/auth', () => ({
  registerCustomer: vi.fn(),
  loginBackend: vi.fn(),
}))

import { registerCustomer, loginBackend } from '@/lib/api/auth'
import { POST } from './route'

const mockedRegister = vi.mocked(registerCustomer)
const mockedLogin = vi.mocked(loginBackend)

const validBody = {
  name: 'Jane Doe',
  username: 'janedoe',
  email: 'jane@example.com',
  password: 'NewPass123', // 10 chars, 3 classes
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/register', () => {
  it('registers and auto-logs-in, setting both cookies', async () => {
    mockedRegister.mockResolvedValue({ id: 'u1' } as never)
    mockedLogin.mockResolvedValue({ access_token: 'a1', refresh_token: 'r1' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
    expect(res.cookies.get('nexio_session')?.value).toBe('a1')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('r1')
  })

  it('returns 400 for a reserved username', async () => {
    const res = await POST(req({ ...validBody, username: 'admin' }))
    expect(res.status).toBe(400)
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid e-mail', async () => {
    const res = await POST(req({ ...validBody, email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a weak password', async () => {
    const res = await POST(req({ ...validBody, password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('maps a 409 from register to already_exists', async () => {
    mockedRegister.mockRejectedValue(new ApiError(409, null, 'taken'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_exists' })
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('maps a 429 from register to rate_limited', async () => {
    mockedRegister.mockRejectedValue(new ApiError(429, null, 'slow down'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ code: 'rate_limited' })
  })

  it('collapses a register 500 into a 502', async () => {
    mockedRegister.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(502)
  })

  it('signals requiresLogin (no cookies) when the account is created but auto-login fails', async () => {
    mockedRegister.mockResolvedValue({ id: 'u1' } as never)
    mockedLogin.mockRejectedValue(new ApiError(401, null, 'nope'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, requiresLogin: true })
    expect(res.cookies.get('nexio_session')).toBeUndefined()
  })
})
