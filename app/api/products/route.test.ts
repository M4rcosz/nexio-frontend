import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access')
vi.mock('@/lib/api/products')
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { createProduct, listProducts } from '@/lib/api/products'
import { GET, POST } from './route'

const mockedGetAdminContext = vi.mocked(getAdminContext)
const mockedCreateProduct = vi.mocked(createProduct)
const mockedListProducts = vi.mocked(listProducts)

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

const validBody = {
  name: 'Burger',
  price: '25.90',
  categoryId: '11111111-1111-1111-1111-111111111111',
  imageUrl: 'https://cdn.example.com/a.png',
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/products', () => {
  it('returns 401 session_expired without a session', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'session_expired' })
  })

  it('returns 403 forbidden for a MANAGER', async () => {
    mockedGetAdminContext.mockResolvedValue(MANAGER)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'forbidden' })
  })

  it('returns 201 for an ADMIN with a valid body', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateProduct.mockResolvedValue({ id: 'p1' } as never)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'p1' })
    expect(mockedCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Burger' }),
    )
  })

  it('creates a product with no image at all', async () => {
    // `imageUrl` is optional since backend 5.0.0 — the image is attached
    // afterwards through the upload/confirm pair.
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateProduct.mockResolvedValue({ id: 'p1', imageUrl: null } as never)
    const res = await POST(
      postReq({
        name: validBody.name,
        price: validBody.price,
        categoryId: validBody.categoryId,
      }),
    )
    expect(res.status).toBe(201)
    expect(mockedCreateProduct).toHaveBeenCalledWith(
      expect.not.objectContaining({ imageUrl: expect.anything() }),
    )
  })

  it('returns 400 when the body carries an unknown key (.strict)', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ ...validBody, isActive: true }))
    expect(res.status).toBe(400)
    expect(mockedCreateProduct).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid price', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(postReq({ ...validBody, price: '0' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-http imageUrl', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    const res = await POST(
      postReq({ ...validBody, imageUrl: 'ftp://cdn.example.com/a.png' }),
    )
    expect(res.status).toBe(400)
  })

  it('maps a service ApiError(409) to 409 name_taken', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateProduct.mockRejectedValue(new ApiError(409, null, 'conflict'))
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'name_taken' })
  })

  it('maps a service ApiError(500) to 502', async () => {
    mockedGetAdminContext.mockResolvedValue(ADMIN)
    mockedCreateProduct.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(502)
  })
})

describe('GET /api/products', () => {
  it('returns the page on success', async () => {
    mockedListProducts.mockResolvedValue({
      data: [{ id: 'p1' }],
      meta: { limit: 12, nextCursor: null, hasMore: false },
    } as never)
    const res = await GET(new Request('http://localhost/api/products?search=b'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ data: [{ id: 'p1' }] })
  })

  it('swallows a service error into a 200 with empty data (search box contract)', async () => {
    mockedListProducts.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(new Request('http://localhost/api/products'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ data: [] })
    expect(body).toHaveProperty('error')
  })
})
