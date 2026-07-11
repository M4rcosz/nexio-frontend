import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/orders')

import { getSession } from '@/lib/auth/session'
import { updateOrderStatus } from '@/lib/api/orders'
import { PATCH } from './route'

const mockedGetSession = vi.mocked(getSession)
const mockedUpdateStatus = vi.mocked(updateOrderStatus)

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/orders/o1/status', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function sessionWithRole(role: string) {
  return { sub: 'u1', username: 'u', role } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/orders/[id]/status', () => {
  it('returns 403 when there is no session', async () => {
    mockedGetSession.mockResolvedValue(null)
    const res = await PATCH(patchReq({ orderStatus: 'READY' }), ctx('o1'))
    expect(res.status).toBe(403)
    expect(mockedUpdateStatus).not.toHaveBeenCalled()
  })

  it('returns 403 for a CUSTOMER (non-staff role)', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('CUSTOMER'))
    const res = await PATCH(patchReq({ orderStatus: 'READY' }), ctx('o1'))
    expect(res.status).toBe(403)
    expect(mockedUpdateStatus).not.toHaveBeenCalled()
  })

  it('updates the status for a staff member', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('KITCHEN'))
    mockedUpdateStatus.mockResolvedValue({
      id: 'o1',
      orderStatus: 'READY',
    } as never)
    const res = await PATCH(patchReq({ orderStatus: 'READY' }), ctx('o1'))
    expect(res.status).toBe(200)
    expect(mockedUpdateStatus).toHaveBeenCalledWith('o1', 'READY')
  })

  it('returns 400 for an unknown status value', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('MANAGER'))
    const res = await PATCH(patchReq({ orderStatus: 'FLYING' }), ctx('o1'))
    expect(res.status).toBe(400)
    expect(mockedUpdateStatus).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('ADMIN'))
    mockedUpdateStatus.mockResolvedValue(null as never)
    const res = await PATCH(patchReq({ orderStatus: 'READY' }), ctx('o1'))
    expect(res.status).toBe(404)
  })

  it('maps a coded invalid_transition error to 422', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('ATTENDANT'))
    mockedUpdateStatus.mockRejectedValue({ code: 'invalid_transition' })
    const res = await PATCH(patchReq({ orderStatus: 'DELIVERED' }), ctx('o1'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'invalid_transition' })
  })

  it('maps a backend ApiError(422) to invalid_transition too', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('ADMIN'))
    mockedUpdateStatus.mockRejectedValue(new ApiError(422, null, 'nope'))
    const res = await PATCH(patchReq({ orderStatus: 'DELIVERED' }), ctx('o1'))
    expect(res.status).toBe(422)
  })

  it('returns 500 for an unexpected error', async () => {
    mockedGetSession.mockResolvedValue(sessionWithRole('ADMIN'))
    mockedUpdateStatus.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(patchReq({ orderStatus: 'READY' }), ctx('o1'))
    expect(res.status).toBe(500)
  })
})
