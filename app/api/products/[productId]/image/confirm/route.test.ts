import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/products')
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { confirmProductImage } from '@/lib/api/products'
import { POST } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedConfirm = vi.mocked(confirmProductImage)
const mockedRevalidateTag = vi.mocked(revalidateTag)

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'
const PATH = `products/${PRODUCT_ID}/f81d4fae.jpg`

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

const PRODUCT = {
  id: PRODUCT_ID,
  imageUrl: 'https://cdn.test/product-images/f81d4fae.jpg',
} as never

function req(body: unknown): Request {
  return new Request(
    `http://localhost/api/products/${PRODUCT_ID}/image/confirm`,
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

describe('POST /api/products/:productId/image/confirm', () => {
  it('returns 401 without a session', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await POST(req({ path: PATH }), ctx())
    expect(res.status).toBe(401)
  })

  it('allows a MANAGER', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    mockedConfirm.mockResolvedValue(PRODUCT)
    const res = await POST(req({ path: PATH }), ctx())
    expect(res.status).toBe(200)
  })

  it('returns the updated product and busts both caches', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedConfirm.mockResolvedValue(PRODUCT)

    const res = await POST(req({ path: PATH }), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(PRODUCT)
    expect(mockedConfirm).toHaveBeenCalledWith(PRODUCT_ID, PATH)
    expect(mockedRevalidateTag).toHaveBeenCalledWith('products')
    expect(mockedRevalidateTag).toHaveBeenCalledWith(`product:${PRODUCT_ID}`)
    // PublicMenuItem carries imageUrl too, and confirm deletes the object it
    // replaced — so a stale menu cache serves a URL to bytes that are gone.
    expect(mockedRevalidateTag).toHaveBeenCalledWith('menu')
  })

  it('passes the path through untouched', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedConfirm.mockResolvedValue(PRODUCT)
    const odd = `products/${PRODUCT_ID}/A b+c%20.png`
    await POST(req({ path: odd }), ctx())
    expect(mockedConfirm).toHaveBeenCalledWith(PRODUCT_ID, odd)
  })

  it('rejects an empty or oversized path', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    expect((await POST(req({ path: '' }), ctx())).status).toBe(400)
    expect((await POST(req({ path: 'x'.repeat(301) }), ctx())).status).toBe(400)
    expect(mockedConfirm).not.toHaveBeenCalled()
  })

  it('rejects a non-uuid product id', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(req({ path: PATH }), ctx('nope'))
    expect(res.status).toBe(400)
    expect(mockedConfirm).not.toHaveBeenCalled()
  })

  it('maps 404 to upload_incomplete — the client restarts from the mint', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedConfirm.mockRejectedValue(new ApiError(404, null, 'No object.'))
    const res = await POST(req({ path: PATH }), ctx())
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'upload_incomplete' })
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
  })

  it('maps 422 to image_rejected — the client re-picks the file', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedConfirm.mockRejectedValue(new ApiError(422, null, 'Bad file.'))
    const res = await POST(req({ path: PATH }), ctx())
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'image_rejected' })
  })

  it('maps a backend 5xx to 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedConfirm.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req({ path: PATH }), ctx())
    expect(res.status).toBe(502)
  })
})
