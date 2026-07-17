import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/ai')

import { getAdminContext } from '@/lib/auth/access'
import { enrollAiMembership } from '@/lib/api/ai'
import { POST } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedEnroll = vi.mocked(enrollAiMembership)

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
  it('returns 403 when there is no admin context', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await POST(req({ initialBalance: 100 }), ctx('u2'))
    expect(res.status).toBe(403)
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
    })
    const res = await POST(req({ initialBalance: 10000 }), ctx('u2'))
    expect(res.status).toBe(201)
    expect(mockedEnroll).toHaveBeenCalledWith('u2', 10000)
  })

  it('maps a 409 to code already_enrolled', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedEnroll.mockRejectedValue(new ApiError(409, null, 'dup'))
    const res = await POST(req({ initialBalance: 10 }), ctx('u2'))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_enrolled' })
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
