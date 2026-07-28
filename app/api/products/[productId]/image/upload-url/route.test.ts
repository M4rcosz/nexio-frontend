import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/products')

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { mintProductImageUploadUrl } from '@/lib/api/products'
import { POST } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedMint = vi.mocked(mintProductImageUploadUrl)

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'

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

const MINTED = {
  signedUrl: 'https://storage.test/put?token=abc',
  token: 'abc',
  path: `products/${PRODUCT_ID}/f81d.jpg`,
  expiresInSeconds: 7200,
}

function req(body: unknown): Request {
  return new Request(
    `http://localhost/api/products/${PRODUCT_ID}/image/upload-url`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function ctx(productId = PRODUCT_ID) {
  return { params: Promise.resolve({ productId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/products/:productId/image/upload-url', () => {
  it('returns 401 without a session', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await POST(req({ contentType: 'image/png' }), ctx())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
  })

  it('allows a MANAGER — unlike PATCH /products/:id next door', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    mockedMint.mockResolvedValue(MINTED)
    const res = await POST(req({ contentType: 'image/png' }), ctx())
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(MINTED)
  })

  it('returns 201 with the minted credential for an ADMIN', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedMint.mockResolvedValue(MINTED)
    const res = await POST(req({ contentType: 'image/jpeg' }), ctx())
    expect(res.status).toBe(201)
    expect(mockedMint).toHaveBeenCalledWith(PRODUCT_ID, 'image/jpeg')
  })

  it('rejects a content type outside the allowlist', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(req({ contentType: 'image/svg+xml' }), ctx())
    expect(res.status).toBe(400)
    expect(mockedMint).not.toHaveBeenCalled()
  })

  it('rejects a non-uuid product id before building a backend URL', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(req({ contentType: 'image/png' }), ctx('../../etc'))
    expect(res.status).toBe(400)
    expect(mockedMint).not.toHaveBeenCalled()
  })

  it('forwards a 429 as rate_limited so the client can back off', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedMint.mockRejectedValue(new ApiError(429, null, 'Too many requests.'))
    const res = await POST(req({ contentType: 'image/png' }), ctx())
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ code: 'rate_limited' })
  })

  it('maps a backend 5xx to 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedMint.mockRejectedValue(new ApiError(503, null, 'Storage down.'))
    const res = await POST(req({ contentType: 'image/png' }), ctx())
    expect(res.status).toBe(502)
  })
})
