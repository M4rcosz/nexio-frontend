import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')

import { getSession, hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { POST, GET } from './route'

const mockedGate = vi.mocked(hasActiveOrRefreshableSession)
const mockedGetSession = vi.mocked(getSession)
const mockedCreateOrder = vi.mocked(createOrder)
const mockedListMyOrders = vi.mocked(listMyOrders)

// The schema validates businessUnitId and every productId as UUIDs (doc §4).
const BU_ID = '11111111-1111-4111-8111-111111111111'
const P_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = 'f3b7c2e1-1a2b-4c4d-8e6f-7a8b9c0d1e2f'

const validBody = {
  businessUnitId: BU_ID,
  orderChannel: 'WEB' as const,
  orderItems: [{ productId: P_ID, quantity: 2, unitPrice: '25.90' }],
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
  // Default to a staff session so COUNTER/PICKUP orders pass the actor gate;
  // individual tests override the role where the gate itself is under test.
  mockedGetSession.mockResolvedValue({
    sub: 'u1',
    username: 'attendant',
    role: 'ATTENDANT',
  } as never)
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

  // The backend sends no machine code for a stock shortfall, only prose. Tag
  // it so the client can say *why* the order failed instead of "try again".
  // The fixture mirrors what `rawFetch` actually builds: `message` is copied
  // from `body.message`, so both carry the prose.
  it('tags a stock-shortfall 422 with insufficient_stock', async () => {
    const prose = `Not enough stock of product ${P_ID} at this business unit.`
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(
      new ApiError(422, { message: prose }, prose),
    )
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'insufficient_stock' })
  })

  // A non-JSON 422 leaves the prose in `body` as a raw string, with `message`
  // reduced to "HTTP error 422".
  it('tags a stock shortfall delivered as a non-JSON body', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(
      new ApiError(
        422,
        `Not enough stock of product ${P_ID} at this business unit.`,
        'HTTP error 422',
      ),
    )
    const res = await POST(postReq(validBody))
    expect(await res.json()).toMatchObject({ code: 'insufficient_stock' })
  })

  // The internal product id must never reach the browser.
  it('never forwards the backend prose', async () => {
    const prose = `Not enough stock of product ${P_ID} at this business unit.`
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(
      new ApiError(422, { message: prose }, prose),
    )
    const body = await (await POST(postReq(validBody))).json()
    expect(JSON.stringify(body)).not.toContain(P_ID)
    expect(JSON.stringify(body)).not.toMatch(/not enough stock/i)
  })

  // Any other 422 stays untagged, so a wording drift can never mislabel it.
  it('leaves an unrelated 422 untagged', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockRejectedValue(
      new ApiError(
        422,
        { message: 'The unit is closed right now.' },
        'Invalid request.',
      ),
    )
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(422)
    expect(await res.json()).not.toHaveProperty('code')
  })

  it('forwards a client idempotency-key header to the service', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    await POST(postReq(validBody, { 'idempotency-key': 'idem-123' }))
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ businessUnitId: BU_ID }),
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
        orderItems: [{ productId: P_ID, quantity: 1, unitPrice: '9.999' }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts an APP order with no customer fields (identity from JWT)', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(postReq({ ...validBody, orderChannel: 'APP' }))
    expect(res.status).toBe(201)
  })

  it('returns 400 for an unknown channel', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderChannel: 'DRIVE' }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a customerName on APP/WEB (identity is the JWT)', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({ ...validBody, orderChannel: 'WEB', customerName: 'Maria' }),
    )
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('requires a customerName on TOTEM', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderChannel: 'TOTEM' }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('accepts a TOTEM order with a valid customerName', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'TOTEM',
        customerName: '  Maria  ',
      }),
    )
    expect(res.status).toBe(201)
    // The name is trimmed before it reaches the service (matches the hash the
    // backend stores under the idempotency key).
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Maria' }),
      expect.anything(),
    )
  })

  it('rejects a blank/zero-width TOTEM customerName', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({ ...validBody, orderChannel: 'TOTEM', customerName: '   ' }),
    )
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects both customerId and customerName on COUNTER', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'COUNTER',
        customerId: 'f3b7c2e1-1a2b-4c4d-8e6f-7a8b9c0d1e2f',
        customerName: 'Maria',
      }),
    )
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a COUNTER order with neither customerId nor customerName', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderChannel: 'COUNTER' }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('accepts a COUNTER walk-in with just a customerName', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'COUNTER',
        customerName: 'Seu Antonio',
      }),
    )
    expect(res.status).toBe(201)
  })

  it('accepts a COUNTER order with just a customerId', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'COUNTER',
        customerId: 'f3b7c2e1-1a2b-4c4d-8e6f-7a8b9c0d1e2f',
      }),
    )
    expect(res.status).toBe(201)
  })

  it('rejects a COUNTER order placed by a non-staff caller (403)', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetSession.mockResolvedValue({
      sub: 'c1',
      username: 'customer',
      role: 'CUSTOMER',
    } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'COUNTER',
        customerName: 'Maria',
      }),
    )
    expect(res.status).toBe(403)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a PICKUP order placed by a non-staff caller (403)', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetSession.mockResolvedValue({
      sub: 'c1',
      username: 'customer',
      role: 'CUSTOMER',
    } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'PICKUP',
        customerName: 'Maria',
      }),
    )
    expect(res.status).toBe(403)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  // PICKUP shares COUNTER's channel policy (doc §3) — mirror the quartet.
  it('accepts a PICKUP walk-in with just a customerName', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'PICKUP',
        customerName: 'Seu Antonio',
      }),
    )
    expect(res.status).toBe(201)
  })

  it('accepts a PICKUP order with just a customerId', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCreateOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'PICKUP',
        customerId: CUSTOMER_ID,
      }),
    )
    expect(res.status).toBe(201)
  })

  it('rejects both customerId and customerName on PICKUP', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'PICKUP',
        customerId: CUSTOMER_ID,
        customerName: 'Maria',
      }),
    )
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a PICKUP order with neither customerId nor customerName', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, orderChannel: 'PICKUP' }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it.each(['APP', 'WEB', 'TOTEM'] as const)(
    'rejects a lone customerId on %s (channel disallows it)',
    async (orderChannel) => {
      mockedGate.mockResolvedValue(true)
      const res = await POST(
        postReq({
          ...validBody,
          orderChannel,
          // TOTEM also needs a name, but the customerId rejection fires first.
          customerId: CUSTOMER_ID,
        }),
      )
      expect(res.status).toBe(400)
      expect(mockedCreateOrder).not.toHaveBeenCalled()
    },
  )

  it('rejects a customerName over 60 characters with name_too_long', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({
        ...validBody,
        orderChannel: 'TOTEM',
        customerName: 'a'.repeat(61),
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      details?: { fieldErrors?: Record<string, string[]> }
    }
    expect(body.details?.fieldErrors?.customerName).toContain('name_too_long')
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a non-uuid businessUnitId', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(postReq({ ...validBody, businessUnitId: 'bu-1' }))
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
  })

  it('rejects a non-uuid productId', async () => {
    mockedGate.mockResolvedValue(true)
    const res = await POST(
      postReq({
        ...validBody,
        orderItems: [{ productId: 'p1', quantity: 1, unitPrice: '10.00' }],
      }),
    )
    expect(res.status).toBe(400)
    expect(mockedCreateOrder).not.toHaveBeenCalled()
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
