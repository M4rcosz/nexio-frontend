import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/ai')
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { getAdminContext } from '@/lib/auth/access'
import { enrollAiMembership, revokeAiMembership } from '@/lib/api/ai'
import { revalidateTag } from 'next/cache'
import { DELETE, POST } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedEnroll = vi.mocked(enrollAiMembership)
const mockedRevoke = vi.mocked(revokeAiMembership)
const mockedRevalidate = vi.mocked(revalidateTag)

function ctx(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/ai/memberships/u2', {
    method: 'POST',
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

describe('POST /api/ai/memberships/[userId]', () => {
  it('returns 401 when there is no session', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await POST(req({ initialBalance: 100 }), ctx('u2'))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
    expect(mockedEnroll).not.toHaveBeenCalled()
  })

  it('returns 403 for a MANAGER (ADMIN-only action)', async () => {
    mockedCtx.mockResolvedValue({ role: 'MANAGER' } as never)
    const res = await POST(req({ initialBalance: 100 }), ctx('u2'))
    expect(res.status).toBe(403)
    expect(mockedEnroll).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-integer initial balance', async () => {
    mockedCtx.mockResolvedValue(admin())
    const res = await POST(req({ initialBalance: 1.5 }), ctx('u2'))
    expect(res.status).toBe(400)
    expect(mockedEnroll).not.toHaveBeenCalled()
  })

  it('returns 400 for a negative balance and for one over the ceiling', async () => {
    mockedCtx.mockResolvedValue(admin())
    expect((await POST(req({ initialBalance: -1 }), ctx('u2'))).status).toBe(
      400,
    )
    expect(
      (await POST(req({ initialBalance: 2147483648 }), ctx('u2'))).status,
    ).toBe(400)
  })

  it('enrolls the user and returns 201', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedEnroll.mockResolvedValue({
      id: 'aim_1',
      userId: 'u2',
      tokenBalance: 10000,
      createdAt: 'now',
      revokedAt: null,
    })
    const res = await POST(req({ initialBalance: 10000 }), ctx('u2'))
    expect(res.status).toBe(201)
    expect(mockedEnroll).toHaveBeenCalledWith('u2', 10000)
    // Without this the admin usage report keeps serving a list that predates
    // the grant — the reason the panel looked like it had done nothing.
    expect(mockedRevalidate).toHaveBeenCalledWith('ai-memberships')
  })

  it('maps a 409 to code already_enrolled', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedEnroll.mockRejectedValue(new ApiError(409, null, 'dup'))
    const res = await POST(req({ initialBalance: 10 }), ctx('u2'))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_enrolled' })
    // Nothing changed upstream, so nothing to invalidate.
    expect(mockedRevalidate).not.toHaveBeenCalled()
  })

  it('maps a 404 to code user_not_found', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedEnroll.mockRejectedValue(new ApiError(404, null, 'nope'))
    const res = await POST(req({ initialBalance: 10 }), ctx('u2'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'user_not_found' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedEnroll.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req({ initialBalance: 10 }), ctx('u2'))
    expect(res.status).toBe(502)
  })
})

describe('DELETE /api/ai/memberships/[userId] (soft revoke)', () => {
  function delReq(): Request {
    return new Request('http://localhost/api/ai/memberships/u2', {
      method: 'DELETE',
    })
  }

  it('returns 403 for a MANAGER (ADMIN-only action)', async () => {
    mockedCtx.mockResolvedValue({ role: 'MANAGER' } as never)
    const res = await DELETE(delReq(), ctx('u2'))
    expect(res.status).toBe(403)
    expect(mockedRevoke).not.toHaveBeenCalled()
  })

  it('revokes and echoes the row, balance untouched', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedRevoke.mockResolvedValue({
      id: 'aim_1',
      userId: 'u2',
      tokenBalance: 10000,
      createdAt: 'now',
      revokedAt: '2026-07-21T10:00:00.000Z',
    })
    const res = await DELETE(delReq(), ctx('u2'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      revokedAt: '2026-07-21T10:00:00.000Z',
      tokenBalance: 10000,
    })
  })

  it('maps a missing membership to 404 not_enrolled', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedRevoke.mockResolvedValue(null)
    const res = await DELETE(delReq(), ctx('u2'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'not_enrolled' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedRevoke.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await DELETE(delReq(), ctx('u2'))
    expect(res.status).toBe(502)
  })
})
