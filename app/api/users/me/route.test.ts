import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/users')

import { isAuthenticated } from '@/lib/auth/session'
import { getMe, updateMe, isAccountGoneError } from '@/lib/api/users'
import { GET, PATCH } from './route'

const mockedIsAuth = vi.mocked(isAuthenticated)
const mockedGetMe = vi.mocked(getMe)
const mockedUpdateMe = vi.mocked(updateMe)
const mockedIsAccountGone = vi.mocked(isAccountGoneError)

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/users/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: the account-gone heuristic is off unless a test opts in.
  mockedIsAccountGone.mockReturnValue(false)
})

describe('GET /api/users/me', () => {
  it('returns 401 when not authenticated', async () => {
    mockedIsAuth.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockedGetMe).not.toHaveBeenCalled()
  })

  it('returns the profile on success', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedGetMe.mockResolvedValue({ id: 'u1', name: 'Ana' } as never)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'u1' })
  })

  it('signs the user out with 404 account_gone on an unambiguous removal signal', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedGetMe.mockRejectedValue(
      new ApiError(404, { code: 'account_gone' }, 'gone'),
    )
    mockedIsAccountGone.mockReturnValue(true)
    const res = await GET()
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'account_gone' })
  })

  it('does NOT sign out on a bare/ambiguous 404', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedGetMe.mockRejectedValue(new ApiError(404, null, 'not found'))
    mockedIsAccountGone.mockReturnValue(false)
    const res = await GET()
    // A generic 404 is forwarded as-is, not turned into account_gone.
    expect(res.status).toBe(404)
    expect(await res.json()).not.toMatchObject({ code: 'account_gone' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedGetMe.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET()
    expect(res.status).toBe(502)
  })
})

describe('PATCH /api/users/me', () => {
  it('returns 401 when not authenticated', async () => {
    mockedIsAuth.mockResolvedValue(false)
    const res = await PATCH(patchReq({ name: 'Ana' }))
    expect(res.status).toBe(401)
    expect(mockedUpdateMe).not.toHaveBeenCalled()
  })

  it('updates the profile with a valid body', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedUpdateMe.mockResolvedValue({ id: 'u1', name: 'Ana' } as never)
    const res = await PATCH(patchReq({ name: 'Ana' }))
    expect(res.status).toBe(200)
    expect(mockedUpdateMe).toHaveBeenCalledWith({ name: 'Ana' })
  })

  it('returns 400 when neither name nor phone is provided', async () => {
    mockedIsAuth.mockResolvedValue(true)
    const res = await PATCH(patchReq({}))
    expect(res.status).toBe(400)
    expect(mockedUpdateMe).not.toHaveBeenCalled()
  })

  it('returns 400 for a too-short name', async () => {
    mockedIsAuth.mockResolvedValue(true)
    const res = await PATCH(patchReq({ name: 'A' }))
    expect(res.status).toBe(400)
  })

  it('maps a backend 409 to phone_taken', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedUpdateMe.mockRejectedValue(new ApiError(409, null, 'conflict'))
    const res = await PATCH(patchReq({ phone: '11999999999' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'phone_taken' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedIsAuth.mockResolvedValue(true)
    mockedUpdateMe.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(patchReq({ name: 'Ana' }))
    expect(res.status).toBe(502)
  })
})
