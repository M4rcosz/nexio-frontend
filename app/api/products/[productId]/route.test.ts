import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/products')
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { updateProduct } from '@/lib/api/products'
import { PATCH } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedUpdateProduct = vi.mocked(updateProduct)
const mockedRevalidateTag = vi.mocked(revalidateTag)

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

function req(body: unknown): Request {
  return new Request(`http://localhost/api/products/${PRODUCT_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(productId = PRODUCT_ID) {
  return { params: Promise.resolve({ productId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/products/:productId', () => {
  it('clears the image with an explicit null', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedUpdateProduct.mockResolvedValue({
      id: PRODUCT_ID,
      imageUrl: null,
    } as never)

    const res = await PATCH(req({ imageUrl: null }), ctx())

    expect(res.status).toBe(200)
    expect(mockedUpdateProduct).toHaveBeenCalledWith(PRODUCT_ID, {
      imageUrl: null,
    })
  })

  it('answers 401 for a missing session, not 403', async () => {
    // An expired token should send the admin to re-login, not tell them they
    // lack permission — useErrorMessage keys off the status.
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await PATCH(req({ imageUrl: null }), ctx())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
  })

  it('busts the per-unit menu caches as well as the product ones', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedUpdateProduct.mockResolvedValue({ id: PRODUCT_ID } as never)
    await PATCH(req({ imageUrl: null }), ctx())
    expect(mockedRevalidateTag).toHaveBeenCalledWith('menu')
  })

  it('refuses a MANAGER — clearing is ADMIN-only, unlike the image routes', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    const res = await PATCH(req({ imageUrl: null }), ctx())
    expect(res.status).toBe(403)
    expect(mockedUpdateProduct).not.toHaveBeenCalled()
  })

  it('still accepts a free-text http(s) imageUrl for externally hosted images', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedUpdateProduct.mockResolvedValue({ id: PRODUCT_ID } as never)
    const res = await PATCH(
      req({ imageUrl: 'https://cdn.example.com/a.png' }),
      ctx(),
    )
    expect(res.status).toBe(200)
  })

  it('rejects a non-http imageUrl', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await PATCH(req({ imageUrl: 'ftp://cdn/a.png' }), ctx())
    expect(res.status).toBe(400)
    expect(mockedUpdateProduct).not.toHaveBeenCalled()
  })

  it('rejects an empty patch', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await PATCH(req({}), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 when the product is gone', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedUpdateProduct.mockResolvedValue(null)
    const res = await PATCH(req({ imageUrl: null }), ctx())
    expect(res.status).toBe(404)
  })

  it('maps a service ApiError(500) to 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedUpdateProduct.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(req({ imageUrl: null }), ctx())
    expect(res.status).toBe(502)
  })
})
