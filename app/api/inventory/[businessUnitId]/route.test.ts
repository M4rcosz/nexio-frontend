import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

// Keep the real canAccessUnit (pure scoping check); only getAdminContext is stubbed.
vi.mock('@/lib/auth/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/access')>()),
  getAdminContext: vi.fn(),
}))
vi.mock('@/lib/api/inventory')

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { listInventory } from '@/lib/api/inventory'
import { GET } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedListInventory = vi.mocked(listInventory)

const ADMIN: AdminContext = {
  userId: 'u1',
  role: 'ADMIN',
  scopedBusinessUnitIds: null,
  scopedBusinessUnitId: null,
  manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
}

const MANAGER: AdminContext = {
  userId: 'u2',
  role: 'MANAGER',
  scopedBusinessUnitIds: ['bu-1'],
  scopedBusinessUnitId: 'bu-1',
  manageableRoles: ['ATTENDANT', 'KITCHEN'],
}

function req(): Request {
  return new Request('http://localhost/api/inventory/bu-1')
}

function ctx(businessUnitId: string) {
  return { params: Promise.resolve({ businessUnitId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/inventory/[businessUnitId]', () => {
  it('returns 403 when there is no admin context', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await GET(req(), ctx('bu-1'))
    expect(res.status).toBe(403)
  })

  it('returns 403 unit_forbidden for a MANAGER out of scope', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    const res = await GET(req(), ctx('bu-2'))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'unit_forbidden' })
  })

  it('returns 200 for an ADMIN (unscoped)', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListInventory.mockResolvedValue({
      data: [],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    } as never)
    const res = await GET(req(), ctx('any-unit'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for a MANAGER within scope', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    mockedListInventory.mockResolvedValue({
      data: [{ id: 'i1' }],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    } as never)
    const res = await GET(req(), ctx('bu-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ data: [{ id: 'i1' }] })
  })

  it('propagates a service ApiError(<500) status', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListInventory.mockRejectedValue(new ApiError(404, null, 'nope'))
    const res = await GET(req(), ctx('bu-1'))
    expect(res.status).toBe(404)
  })

  it('maps a service 5xx to 500', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListInventory.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(req(), ctx('bu-1'))
    expect(res.status).toBe(500)
  })
})
