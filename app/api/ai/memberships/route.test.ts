import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/ai')

import { getAdminContext } from '@/lib/auth/access'
import { listAiMembershipUsage } from '@/lib/api/ai'
import { GET } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedList = vi.mocked(listAiMembershipUsage)

function req(query = ''): Request {
  return new Request(`http://localhost/api/ai/memberships${query}`)
}

const emptyReport = {
  periodFrom: '2026-06-21T00:00:00.000Z',
  periodTo: '2026-07-21T00:00:00.000Z',
  data: [],
  meta: { limit: 20, nextCursor: null, hasMore: false },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ai/memberships (admin usage report)', () => {
  it('returns 401 when there is no admin context', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('returns 403 for a MANAGER — the report carries user emails', async () => {
    mockedCtx.mockResolvedValue({ role: 'MANAGER' } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('defaults to no explicit window, letting the server pick 30 days', async () => {
    mockedCtx.mockResolvedValue({ role: 'ADMIN' } as never)
    mockedList.mockResolvedValue(emptyReport)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(mockedList).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      cursor: undefined,
      limit: 20,
    })
  })

  it('rejects an inverted range with 422 before any round-trip', async () => {
    mockedCtx.mockResolvedValue({ role: 'ADMIN' } as never)
    const res = await GET(
      req('?from=2026-07-01T00:00:00Z&to=2026-06-01T00:00:00Z'),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'invalid_period' })
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('rejects a non-ISO date with 400 (a malformed shape, not a bad period)', async () => {
    mockedCtx.mockResolvedValue({ role: 'ADMIN' } as never)
    const res = await GET(req('?from=2026-07-01'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'invalid_query' })
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('maps an upstream 422 (malformed cursor) to code invalid_cursor', async () => {
    mockedCtx.mockResolvedValue({ role: 'ADMIN' } as never)
    mockedList.mockRejectedValue(new ApiError(422, null, 'bad cursor'))
    const res = await GET(req('?cursor=garbage'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'invalid_cursor' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedCtx.mockResolvedValue({ role: 'ADMIN' } as never)
    mockedList.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(req())
    expect(res.status).toBe(502)
  })
})
