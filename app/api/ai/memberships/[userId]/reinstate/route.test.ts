import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/ai')
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { getAdminContext } from '@/lib/auth/access'
import { reinstateAiMembership } from '@/lib/api/ai'
import { POST } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedReinstate = vi.mocked(reinstateAiMembership)

function ctx(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

function req(): Request {
  return new Request('http://localhost/api/ai/memberships/u2/reinstate', {
    method: 'POST',
  })
}

function admin() {
  return { role: 'ADMIN' } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/ai/memberships/[userId]/reinstate', () => {
  it('returns 401 when there is no session', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await POST(req(), ctx('u2'))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
    expect(mockedReinstate).not.toHaveBeenCalled()
  })

  it('returns 403 for a MANAGER (ADMIN-only action)', async () => {
    mockedCtx.mockResolvedValue({ role: 'MANAGER' } as never)
    const res = await POST(req(), ctx('u2'))
    expect(res.status).toBe(403)
    expect(mockedReinstate).not.toHaveBeenCalled()
  })

  it('clears revokedAt and returns the fresh row', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedReinstate.mockResolvedValue({
      id: 'aim_1',
      userId: 'u2',
      tokenBalance: 10000,
      createdAt: 'now',
      revokedAt: null,
    })
    const res = await POST(req(), ctx('u2'))
    expect(res.status).toBe(200)
    expect(mockedReinstate).toHaveBeenCalledWith('u2')
    expect(await res.json()).toMatchObject({ revokedAt: null })
  })

  it('maps a missing membership to 404 not_enrolled', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedReinstate.mockResolvedValue(null)
    const res = await POST(req(), ctx('u2'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'not_enrolled' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedCtx.mockResolvedValue(admin())
    mockedReinstate.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req(), ctx('u2'))
    expect(res.status).toBe(502)
  })
})
