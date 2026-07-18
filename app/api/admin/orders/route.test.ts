import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/orders')

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { listOrders } from '@/lib/api/orders'
import { GET } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedListOrders = vi.mocked(listOrders)

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

function req(qs = ''): Request {
  return new Request(`http://localhost/api/admin/orders${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/orders', () => {
  it('returns 403 when the caller is not an admin/manager', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(mockedListOrders).not.toHaveBeenCalled()
  })

  it('applies defaults when no query params are given', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    mockedListOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(req())
    expect(mockedListOrders).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
      businessUnitId: undefined,
      orderChannel: undefined,
      orderStatus: undefined,
      attendantId: undefined,
      customerId: undefined,
      createdAtFrom: undefined,
      createdAtTo: undefined,
      minTotal: undefined,
      maxTotal: undefined,
      sortBy: undefined,
      sortDir: undefined,
    })
  })

  it('clamps an oversized limit and truncates fractional values', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(req('?limit=500'))
    expect(mockedListOrders).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    )
    mockedListOrders.mockClear()
    await GET(req('?limit=20.9'))
    expect(mockedListOrders).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    )
  })

  it('passes through the full staff filter set and sort', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(
      req(
        '?businessUnitId=bu-1&orderChannel=COUNTER&orderStatus=PREPARING' +
          '&attendantId=att-1&customerId=cus-1' +
          '&createdAtFrom=2026-07-01T00:00:00.000Z&createdAtTo=2026-07-31T23:59:59.999Z' +
          '&minTotal=10.00&maxTotal=250.00&sortBy=totalAmount&sortDir=asc' +
          '&cursor=opaque-token',
      ),
    )
    expect(mockedListOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        businessUnitId: 'bu-1',
        orderChannel: 'COUNTER',
        orderStatus: 'PREPARING',
        attendantId: 'att-1',
        customerId: 'cus-1',
        createdAtFrom: '2026-07-01T00:00:00.000Z',
        createdAtTo: '2026-07-31T23:59:59.999Z',
        minTotal: '10.00',
        maxTotal: '250.00',
        sortBy: 'totalAmount',
        sortDir: 'asc',
        cursor: 'opaque-token',
      }),
    )
  })

  it('drops unknown enum values and malformed money/date filters', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(
      req(
        '?orderChannel=BOGUS&orderStatus=BOGUS&sortBy=BOGUS&sortDir=BOGUS' +
          '&minTotal=abc&maxTotal=12.999&createdAtFrom=not-a-date',
      ),
    )
    expect(mockedListOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        orderChannel: undefined,
        orderStatus: undefined,
        sortBy: undefined,
        sortDir: undefined,
        minTotal: undefined,
        maxTotal: undefined,
        createdAtFrom: undefined,
      }),
    )
  })

  it('maps an invalid/sort-mismatched cursor to 422', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockRejectedValue(
      Object.assign(new Error('bad cursor'), { code: 'invalid_cursor' }),
    )
    const res = await GET(req('?cursor=stale'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'invalid_cursor' })
  })

  it('maps a backend 422 to invalid_cursor too', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockRejectedValue(new ApiError(422, null, 'bad cursor'))
    const res = await GET(req())
    expect(res.status).toBe(422)
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedListOrders.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(req())
    expect(res.status).toBe(502)
  })
})
