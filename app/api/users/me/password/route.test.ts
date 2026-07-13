import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/users')

import { isAuthenticated } from '@/lib/auth/session'
import { changeMyPassword } from '@/lib/api/users'
import { PATCH } from './route'

const mockedIsAuth = vi.mocked(isAuthenticated)
const mockedChange = vi.mocked(changeMyPassword)

const validBody = {
  currentPassword: 'OldPass123',
  newPassword: 'NewPass123', // 10 chars, lower+upper+digit = 3 classes
}

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/users/me/password', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/users/me/password', () => {
  it('returns 401 when not authenticated', async () => {
    mockedIsAuth.mockResolvedValue(false)
    const res = await PATCH(patchReq(validBody))
    expect(res.status).toBe(401)
    expect(mockedChange).not.toHaveBeenCalled()
  })

  it('changes the password and clears both cookies on success', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedChange.mockResolvedValue(undefined)
    const res = await PATCH(patchReq(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, requiresLogin: true })
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
    expect(res.cookies.get('nexio_session')?.maxAge).toBe(0)
  })

  it('returns 400 for a too-short new password', async () => {
    mockedIsAuth.mockResolvedValue(true)
    const res = await PATCH(patchReq({ ...validBody, newPassword: 'Ab1' }))
    expect(res.status).toBe(400)
    expect(mockedChange).not.toHaveBeenCalled()
  })

  it('returns 400 when the new password uses fewer than 3 character classes', async () => {
    mockedIsAuth.mockResolvedValue(true)
    // 10 lowercase-only chars: 1 class, fails the .refine.
    const res = await PATCH(
      patchReq({ ...validBody, newPassword: 'abcdefghij' }),
    )
    expect(res.status).toBe(400)
  })

  it('maps a backend 401 to wrong_password', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedChange.mockRejectedValue(new ApiError(401, null, 'bad'))
    const res = await PATCH(patchReq(validBody))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'wrong_password' })
  })

  it('maps a backend 422 to same_password', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedChange.mockRejectedValue(new ApiError(422, null, 'same'))
    const res = await PATCH(patchReq(validBody))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'same_password' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedChange.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(patchReq(validBody))
    expect(res.status).toBe(502)
  })
})
