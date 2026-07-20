// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError } from './errors'

let thrown: unknown = null

vi.mock('./admin-users', () => ({
  listInternalUsers: vi.fn(async () => {
    if (thrown) throw thrown
    return { data: [], meta: { limit: 20, nextCursor: null, hasMore: false } }
  }),
  createInternalUser: vi.fn(),
}))

const ctx = {
  userId: 'u',
  role: 'ADMIN' as const,
  scopedBusinessUnitIds: null,
  scopedBusinessUnitId: null,
  manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
}
let session: unknown = ctx

vi.mock('@/lib/auth/access', () => ({
  getAdminContext: async () => session,
  canManageRole: () => true,
}))

const { GET } = await import('@/app/api/admin/users/route')
const call = () => GET(new Request('http://x/api/admin/users'))

beforeEach(() => {
  thrown = null
  session = ctx
})

describe('GET /api/admin/users error mapping', () => {
  it('maps a network failure (ApiError status 0) to 502, not a RangeError', async () => {
    // serverFetch throws ApiError(0, …) on a connection failure or the 4s
    // timeout. A raw `err.status < 500` check would hand NextResponse a status
    // of 0 — outside the legal 200..599 range — so it throws and the client
    // gets an opaque framework 500 exactly when the backend is down.
    thrown = new ApiError(0, null, 'Network failure: backend:3000')
    expect((await call()).status).toBe(502)
  })

  it('collapses an upstream 5xx to 502', async () => {
    thrown = new ApiError(500, null, 'boom')
    expect((await call()).status).toBe(502)
  })

  it('collapses a non-ApiError to 502', async () => {
    thrown = new TypeError('unexpected')
    expect((await call()).status).toBe(502)
  })

  it('passes a genuine upstream 4xx through unchanged', async () => {
    thrown = new ApiError(409, null, 'conflict')
    expect((await call()).status).toBe(409)
  })

  it('keeps the masked 404 neutral and does not reword it', async () => {
    thrown = new ApiError(404, null, 'unit not found')
    const res = await call()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not found.' })
    // Must never hint that the unit exists but is off-limits (docs §1.3).
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/permission|forbid/)
  })

  it('answers an absent session with 401, not 403', async () => {
    // getAdminContext() returns null for both "expired" and "wrong role";
    // the client keys re-auth off 401 (contract §0).
    session = null
    const res = await call()
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('session_expired')
  })
})
