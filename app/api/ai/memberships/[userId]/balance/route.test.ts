import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/ai')

import { getAdminContext } from '@/lib/auth/access'
import { adjustAiMembershipBalance } from '@/lib/api/ai'
import { PATCH } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedAdjust = vi.mocked(adjustAiMembershipBalance)

function ctx(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/ai/memberships/u2/balance', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function admin() {
  return { role: 'ADMIN' } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/ai/memberships/[userId]/balance', () => {
  it('returns 403 without an admin context', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await PATCH(req({ delta: 100 }), ctx('u2'))
    expect(res.status).toBe(403)
    expect(mockedAdjust).not.toHaveBeenCalled()
  })

  it('returns 403 for a MANAGER', async () => {
    mockedCtx.mockResolvedValue({ role: 'MANAGER' } as never)
    const res = await PATCH(req({ delta: 100 }), ctx('u2'))
    expect(res.status).toBe(403)
  })

  it('rejects a zero delta with 400', async () => {
    mockedCtx.mockResolvedValue(admin())
    const res = await PATCH(req({ delta: 0 }), ctx('u2'))
    expect(res.status).toBe(400)
    expect(mockedAdjust).not.toHaveBeenCalled()
  })

  it('rejects a non-integer delta with 400', async () => {
    mockedCtx.mockResolvedValue(admin())
    const res = await PATCH(req({ delta: 2.5 }), ctx('u2'))
    expect(res.status).toBe(400)
  })

  it('applies a signed delta and returns 200', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedAdjust.mockResolvedValue({
      id: 'aim_1',
      userId: 'u2',
      tokenBalance: 5000,
      createdAt: 'now',
    })
    const res = await PATCH(req({ delta: -1000 }), ctx('u2'))
    expect(res.status).toBe(200)
    expect(mockedAdjust).toHaveBeenCalledWith('u2', -1000)
    expect(await res.json()).toMatchObject({ tokenBalance: 5000 })
  })

  it('returns 404 code not_enrolled when the user has no membership', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedAdjust.mockResolvedValue(null)
    const res = await PATCH(req({ delta: 100 }), ctx('u2'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'not_enrolled' })
  })

  it('maps a backend 422 to code balance_out_of_range', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedAdjust.mockRejectedValue(new ApiError(422, null, 'below zero'))
    const res = await PATCH(req({ delta: -999999 }), ctx('u2'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'balance_out_of_range' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedAdjust.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(req({ delta: 100 }), ctx('u2'))
    expect(res.status).toBe(502)
  })
})
