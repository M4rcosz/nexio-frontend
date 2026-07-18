import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { cancelOrder } from '@/lib/api/orders'
import { POST } from './route'

const mockedGate = vi.mocked(hasActiveOrRefreshableSession)
const mockedCancel = vi.mocked(cancelOrder)

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function req() {
  return new Request('http://localhost/api/orders/o1/cancel', {
    method: 'POST',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/orders/[id]/cancel', () => {
  it('returns 401 without a session', async () => {
    mockedGate.mockResolvedValue(false)
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(401)
    expect(mockedCancel).not.toHaveBeenCalled()
  })

  it('cancels the order and returns it', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockResolvedValue({
      id: 'o1',
      orderStatus: 'CANCELLED',
    } as never)
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(200)
    expect(mockedCancel).toHaveBeenCalledWith('o1')
    expect(await res.json()).toMatchObject({ orderStatus: 'CANCELLED' })
  })

  it('returns 404 when the order does not exist', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockResolvedValue(null as never)
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(404)
  })

  it('propagates a backend 403 instead of masking it as 500', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockRejectedValue(new ApiError(403, null, 'forbidden'))
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(403)
  })

  it('collapses a backend 500 into a 502', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(502)
  })

  it('maps a mock cancel_window_closed error to 422', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockRejectedValue(
      Object.assign(new Error('past window'), {
        code: 'cancel_window_closed',
      }),
    )
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'cancel_window_closed' })
  })

  it('maps a backend 422 to the cancel_window_closed code', async () => {
    mockedGate.mockResolvedValue(true)
    mockedCancel.mockRejectedValue(new ApiError(422, null, 'past window'))
    const res = await POST(req(), ctx('o1'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'cancel_window_closed' })
  })
})
