import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')

import { ApiError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { getOrder } from '@/lib/api/orders'
import { GET } from './route'

const mockedGate = vi.mocked(hasActiveOrRefreshableSession)
const mockedGetOrder = vi.mocked(getOrder)

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/orders/[id]', () => {
  it('returns 401 when there is neither a valid session nor a refresh token', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await GET(
      new Request('http://localhost/api/orders/o1'),
      ctx('o1'),
    )
    expect(res.status).toBe(401)
    expect(mockedGetOrder).not.toHaveBeenCalled()
  })

  it('proceeds to the backend when the session is expired but refreshable', async () => {
    // The gate lets the request through so the downstream serverFetch can turn
    // the backend 401 into a refresh+retry — the polling endpoint self-heals.
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue({ id: 'o1' } as never)
    const res = await GET(
      new Request('http://localhost/api/orders/o1'),
      ctx('o1'),
    )
    expect(res.status).toBe(200)
    expect(mockedGetOrder).toHaveBeenCalledWith('o1')
  })

  it('returns 404 when the order does not exist', async () => {
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockResolvedValue(null as never)
    const res = await GET(
      new Request('http://localhost/api/orders/o1'),
      ctx('o1'),
    )
    expect(res.status).toBe(404)
  })

  it('propagates a backend 401 instead of masking it as a 500', async () => {
    // When the self-heal refresh cannot recover, serverFetch propagates the 401;
    // the handler must forward it so the polling client can detect a dead session.
    mockedGate.mockResolvedValue(true)
    mockedGetOrder.mockRejectedValue(new ApiError(401, null, 'unauthorized'))
    const res = await GET(
      new Request('http://localhost/api/orders/o1'),
      ctx('o1'),
    )
    expect(res.status).toBe(401)
  })
})
