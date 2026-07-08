import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/categories')

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { createCategory } from '@/lib/api/categories'
import { POST } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedCreateCategory = vi.mocked(createCategory)

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

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/categories', () => {
  it('returns 401 session_expired without a session', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await POST(postReq({ name: 'Drinks' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
  })

  it('returns 403 forbidden for a MANAGER (ADMIN-only)', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    const res = await POST(postReq({ name: 'Drinks' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'forbidden' })
  })

  it('returns 201 for an ADMIN with a valid body', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateCategory.mockResolvedValue({ id: 'c1' } as never)
    const res = await POST(postReq({ name: 'Drinks' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'c1' })
  })

  it('returns 400 when the body carries an unknown key (.strict)', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ name: 'Drinks', isActive: true }))
    expect(res.status).toBe(400)
    expect(mockedCreateCategory).not.toHaveBeenCalled()
  })

  it('returns 400 for a too-short name', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ name: 'D' }))
    expect(res.status).toBe(400)
  })

  it('maps a service ApiError(409) to 409 name_taken', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateCategory.mockRejectedValue(new ApiError(409, null, 'conflict'))
    const res = await POST(postReq({ name: 'Drinks' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'name_taken' })
  })

  it('maps a service ApiError(500) to 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateCategory.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(postReq({ name: 'Drinks' }))
    expect(res.status).toBe(502)
  })
})
