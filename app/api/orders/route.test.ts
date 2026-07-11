import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { POST, GET } from './route'

const mockedGate = vi.mocked(hasActiveOrRefreshableSession)
const mockedCreateOrder = vi.mocked(createOrder)
const mockedListMyOrders = vi.mocked(listMyOrders)

const validBody = {
  businessUnitId: 'bu-1',
  orderChannel: 'WEB' as const,
  orderItems: [{ productId: 'p1', quantity: 2, unitPrice: '25.90' }],
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/orders', () => {
  it('returns 401 without a session and never hits the backend', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(401)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('creates the order and returns 201', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'o1' })
  })

  it('forwards a client idempotency-key header to the service', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    await POST(postReq(validBody, { 'idempotency-key': 'idem-123' }))
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ businessUnitId: 'bu-1' }),
      { idempotencyKey: 'idem-123' },
    )
  })

  it('mints an idempotency key when the client omits one', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    await POST(postReq(validBody))
    const [, opts] = mockedCreateOrder.mock.calls[0]
    expect(opts?.idempotencyKey).toEqual(expect.any(String))
    expect(opts?.idempotencyKey).not.toHaveLength(0)
  })

  it('returns 400 for an empty order (no items)', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderItems: [] }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('returns 400 for a malformed unitPrice', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({
        ...validBody,
        orderItems: [{ productId: 'p1', quantity: 1, unitPrice: '9.999' }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when the channel is not WEB', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderChannel: 'APP' }))
    expect(res.status).toBe(400)
  })

  it('maps a backend 422 to a friendly unprocessable response', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(new ApiError(422, null, 'nope'))
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(422)
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(502)
  })
})

describe('GET /api/orders', () => {
  it('returns 401 without a session', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await GET(new Request('http://localhost/api/orders'))
    expect(res.status).toBe(401)
    expect(mockedListMyOrders).not.toHaveBeenCalled()
  })

  it('applies defaults when no query params are given', async () => {
    mockedGate.mockResolvedValue(true)
    mockedListMyOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(new Request('http://localhost/api/orders'))
    expect(mockedListMyOrders).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
      orderChannel: undefined,
      orderStatus: undefined,
    })
  })

  it('clamps an oversized limit to 100 and truncates fractional values', async () => {
    mockedGate.mockResolvedValue(true)
    mockedListMyOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(new Request('http://localhost/api/orders?limit=500'))
    expect(mockedListMyOrders).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    )
    mockedListMyOrders.mockClear()
    await GET(new Request('http://localhost/api/orders?limit=20.9'))
    expect(mockedListMyOrders).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    )
  })

  it('passes through valid channel/status filters and drops unknown enum values', async () => {
    mockedGate.mockResolvedValue(true)
    mockedListMyOrders.mockResolvedValue({ data: [], meta: {} } as never)
    await GET(
      new Request(
        'http://localhost/api/orders?orderChannel=WEB&orderStatus=BOGUS',
      ),
    )
    expect(mockedListMyOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        orderChannel: 'WEB',
        orderStatus: undefined,
      }),
    )
  })

  it('maps a backend 403 to a forbidden response', async () => {
    mockedGate.mockResolvedValue(true)
    mockedListMyOrders.mockRejectedValue(new ApiError(403, null, 'staff only'))
    const res = await GET(new Request('http://localhost/api/orders'))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'forbidden' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedGate.mockResolvedValue(true)
    mockedListMyOrders.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(new Request('http://localhost/api/orders'))
    expect(res.status).toBe(502)
  })
})
