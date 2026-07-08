import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

// Keep the real canAccessUnit (pure scoping check); only getAdminContext is stubbed.
vi.mock('@/lib/auth/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/access')>()),
  getAdminContext: vi.fn(),
}))
vi.mock('@/lib/api/inventory')

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { adjustInventory } from '@/lib/api/inventory'
import { POST } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedAdjustInventory = vi.mocked(adjustInventory)

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

const validBody = {
  productId: 'p1',
  type: 'IN' as const,
  quantity: 5,
  reason: 'restock',
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/inventory/bu-1/adjust', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(businessUnitId: string) {
  return { params: Promise.resolve({ businessUnitId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/inventory/[businessUnitId]/adjust', () => {
  it('returns 403 when there is no admin context', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await POST(postReq(validBody), ctx('bu-1'))
    expect(res.status).toBe(403)
  })

  it('returns 403 unit_forbidden for a MANAGER out of scope', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    const res = await POST(postReq(validBody), ctx('bu-2'))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'unit_forbidden' })
  })

  it('returns 200 with the adjusted item for an in-scope MANAGER', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    mockedAdjustInventory.mockResolvedValue({ id: 'i1', quantity: 10 } as never)
    const res = await POST(postReq(validBody), ctx('bu-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'i1' })
    expect(mockedAdjustInventory).toHaveBeenCalledWith(
      'bu-1',
      expect.objectContaining({ productId: 'p1', type: 'IN' }),
    )
  })

  it('returns 400 for an invalid body (bad type enum)', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(
      postReq({ ...validBody, type: 'SIDEWAYS' }),
      ctx('bu-1'),
    )
    expect(res.status).toBe(400)
    expect(mockedAdjustInventory).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-positive quantity', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ ...validBody, quantity: 0 }), ctx('bu-1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing reason', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ ...validBody, reason: '' }), ctx('bu-1'))
    expect(res.status).toBe(400)
  })

  it('maps an inventory_not_found coded error to 404', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedAdjustInventory.mockRejectedValue({ code: 'inventory_not_found' })
    const res = await POST(postReq(validBody), ctx('bu-1'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'inventory_not_found' })
  })

  it('maps an ApiError(422) to 422 inventory_below_zero', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedAdjustInventory.mockRejectedValue(new ApiError(422, null, 'below'))
    const res = await POST(postReq({ ...validBody, type: 'OUT' }), ctx('bu-1'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'inventory_below_zero' })
  })

  it('maps a service 5xx to 500', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedAdjustInventory.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(postReq(validBody), ctx('bu-1'))
    expect(res.status).toBe(500)
  })
})
