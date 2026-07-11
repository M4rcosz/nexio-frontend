import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')
vi.mock('@/lib/api/payments')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { getOrder } from '@/lib/api/orders'
import { createPayment, getOrderPayment } from '@/lib/api/payments'
import { POST, GET } from './route'

const mockedGate = vi.mocked(hasActiveOrRefreshableSession)
const mockedGetOrder = vi.mocked(getOrder)
const mockedCreatePayment = vi.mocked(createPayment)
const mockedGetPayment = vi.mocked(getOrderPayment)

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/orders/o1/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/orders/[id]/payment', () => {
  it('returns 401 without a session', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await POST(postReq({ method: 'PIX' }), ctx('o1'))
    expect(res.status).toBe(401)
    expect(mockedGetOrder).not.toHaveBeenCalled()
  })

  it('returns 400 for an unsupported payment method', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ method: 'BITCOIN' }), ctx('o1'))
    expect(res.status).toBe(400)
    expect(mockedGetOrder).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is missing', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue(null as never)
    const res = await POST(postReq({ method: 'PIX' }), ctx('o1'))
    expect(res.status).toBe(404)
    expect(mockedCreatePayment).not.toHaveBeenCalled()
  })

  it('creates the payment with the order total and returns 201', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue({
      id: 'o1',
      totalAmount: '51.80',
    } as never)
    mockedCreatePayment.mockResolvedValue({ id: 'pay1' } as never)
    const res = await POST(postReq({ method: 'PIX' }), ctx('o1'))
    expect(res.status).toBe(201)
    expect(mockedCreatePayment).toHaveBeenCalledWith(
      { orderId: 'o1', method: 'PIX' },
      '51.80',
    )
  })

  it('maps a backend 422 to not_payable', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue({
      id: 'o1',
      totalAmount: '10.00',
    } as never)
    mockedCreatePayment.mockRejectedValue(new ApiError(422, null, 'nope'))
    const res = await POST(postReq({ method: 'CASH' }), ctx('o1'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'not_payable' })
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue({
      id: 'o1',
      totalAmount: '10.00',
    } as never)
    mockedCreatePayment.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(postReq({ method: 'CASH' }), ctx('o1'))
    expect(res.status).toBe(502)
  })
})

describe('GET /api/orders/[id]/payment', () => {
  it('returns 401 without a session', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await GET(
      new Request('http://localhost/api/orders/o1/payment'),
      ctx('o1'),
    )
    expect(res.status).toBe(401)
    expect(mockedGetPayment).not.toHaveBeenCalled()
  })

  it('returns the payment when it exists', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetPayment.mockResolvedValue({ id: 'pay1' } as never)
    const res = await GET(
      new Request('http://localhost/api/orders/o1/payment'),
      ctx('o1'),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'pay1' })
  })

  it('returns 404 when there is no payment for the order', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetPayment.mockResolvedValue(null as never)
    const res = await GET(
      new Request('http://localhost/api/orders/o1/payment'),
      ctx('o1'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 500 when the service throws', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetPayment.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(
      new Request('http://localhost/api/orders/o1/payment'),
      ctx('o1'),
    )
    expect(res.status).toBe(500)
  })
})
