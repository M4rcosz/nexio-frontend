import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/ai')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { getMyAiMembership } from '@/lib/api/ai'
import { GET } from './route'

const mockedSession = vi.mocked(hasActiveOrRefreshableSession)
const mockedGetMine = vi.mocked(getMyAiMembership)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ai/memberships/me', () => {
  it('returns 401 when there is no session', async () => {
    mockedSession.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockedGetMine).not.toHaveBeenCalled()
  })

  it('returns the membership for an enrolled caller', async () => {
    mockedSession.mockResolvedValue(true)
    mockedGetMine.mockResolvedValue({
      id: 'aim_1',
      userId: 'u1',
      tokenBalance: 9680,
      createdAt: '2026-07-14T12:00:00.000Z',
      revokedAt: null,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ tokenBalance: 9680 })
  })

  it('returns 404 with code not_enrolled when the caller has no membership', async () => {
    mockedSession.mockResolvedValue(true)
    mockedGetMine.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'not_enrolled' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedSession.mockResolvedValue(true)
    mockedGetMine.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET()
    expect(res.status).toBe(502)
  })
})
