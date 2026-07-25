// Mock fallback for the `/products` endpoints (used when
// NEXT_PUBLIC_USE_MOCKS=true or the real backend is offline).
//
// Dish names stay in Portuguese on purpose: they are proper nouns of Brazilian
// cuisine and a real menu would print them as-is, even on an English UI.
import type {
  CreateProductRequest,
  Paginated,
  ProductImageContentType,
  ProductImageUploadUrl,
  ProductResponseDto,
  ProductUpdateDto,
} from '@/lib/api/types'
import { ApiError } from '@/lib/api/errors'
import { mockDelay } from './_delay'
import { getUpload } from './uploadStore'

const NOW = new Date().toISOString()

export const MOCK_PRODUCTS: ProductResponseDto[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Carne de sol com macaxeira',
    description:
      'Grilled sun-dried beef served with fried cassava, clarified butter and grilled coalho cheese.',
    price: '58.90',
    isActive: true,
    categoryId: 'cat_carnes',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Baião de dois',
    description:
      'Rice with green beans, coalho cheese, shredded dried beef and cilantro.',
    price: '42.00',
    isActive: true,
    categoryId: 'cat_acompanhamentos',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Bode guisado',
    description: 'Slow-cooked goat stew served with cassava purée and rice.',
    price: '67.50',
    isActive: true,
    categoryId: 'cat_carnes',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Queijo coalho na brasa',
    description:
      'Coalho cheese skewers grilled over embers, drizzled with cane molasses.',
    price: '28.00',
    isActive: true,
    categoryId: 'cat_petiscos',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Caldo de cana 500ml',
    description: 'Fresh sugarcane juice with lime.',
    price: '9.50',
    isActive: true,
    categoryId: 'cat_bebidas',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Bolo de rolo',
    description: 'Generous slice of bolo de rolo with creamy guava paste.',
    price: '16.00',
    isActive: true,
    categoryId: 'cat_sobremesas',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

export async function listProductsMock(query?: {
  search?: string
  categoryId?: string
}): Promise<Paginated<ProductResponseDto>> {
  await mockDelay()
  let data = MOCK_PRODUCTS.filter((p) => p.isActive)
  if (query?.categoryId) {
    data = data.filter((p) => p.categoryId === query.categoryId)
  }
  if (query?.search) {
    const term = query.search.toLowerCase()
    data = data.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description ?? '').toLowerCase().includes(term),
    )
  }
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function getProductMock(
  id: string,
): Promise<ProductResponseDto | null> {
  await mockDelay()
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null
}

export async function createProductMock(
  input: CreateProductRequest,
): Promise<ProductResponseDto> {
  await mockDelay()
  if (
    MOCK_PRODUCTS.some((p) => p.name.toLowerCase() === input.name.toLowerCase())
  ) {
    throw Object.assign(new Error('Product name already in use.'), {
      code: 'already_exists',
    })
  }
  const now = new Date().toISOString()
  const product: ProductResponseDto = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    isActive: true,
    categoryId: input.categoryId,
    imageUrl: input.imageUrl ?? null,
    createdAt: now,
    updatedAt: now,
  }
  MOCK_PRODUCTS.push(product)
  return { ...product }
}

export async function updateProductMock(
  id: string,
  patch: ProductUpdateDto,
): Promise<ProductResponseDto | null> {
  await mockDelay()
  const product = MOCK_PRODUCTS.find((p) => p.id === id)
  if (!product) return null
  if (
    patch.name !== undefined &&
    MOCK_PRODUCTS.some(
      (p) => p.id !== id && p.name.toLowerCase() === patch.name!.toLowerCase(),
    )
  ) {
    throw new ApiError(
      409,
      { code: 'name_taken' },
      'Product name already in use.',
    )
  }
  if (patch.name !== undefined) product.name = patch.name
  if (patch.description !== undefined) product.description = patch.description
  if (patch.price !== undefined) product.price = patch.price
  if (patch.categoryId !== undefined) product.categoryId = patch.categoryId
  if (patch.imageUrl !== undefined) product.imageUrl = patch.imageUrl
  product.updatedAt = new Date().toISOString()
  return { ...product }
}

const IMAGE_EXTENSION: Record<ProductImageContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * Mints a fake credential. `signedUrl` points at the in-app absorber
 * (`PUT /api/dev/mock-upload`) instead of a storage host so the browser's real
 * three-call flow — including progress and cancel — can be exercised offline.
 */
export async function mintProductImageUploadUrlMock(
  productId: string,
  contentType: ProductImageContentType,
): Promise<ProductImageUploadUrl> {
  await mockDelay()
  if (!MOCK_PRODUCTS.some((p) => p.id === productId)) {
    throw new ApiError(404, { code: 'not_found' }, 'Product not found.')
  }
  const path = `products/${productId}/${crypto.randomUUID()}.${IMAGE_EXTENSION[contentType]}`
  return {
    signedUrl: `/api/dev/mock-upload?path=${encodeURIComponent(path)}`,
    token: 'mock-upload-token',
    path,
    expiresInSeconds: 7200,
  }
}

/**
 * Publishes the mocked upload, mirroring the real endpoint's three outcomes so
 * that mock-mode development exercises the recovery paths and not just the
 * happy one. The URL is regenerated on every confirm — same as the real bucket,
 * where each upload gets a new random object name — so the UI cannot get away
 * with caching it.
 */
export async function confirmProductImageMock(
  productId: string,
  path: string,
): Promise<ProductResponseDto> {
  await mockDelay()
  const product = MOCK_PRODUCTS.find((p) => p.id === productId)
  if (!product) {
    throw new ApiError(404, { code: 'not_found' }, 'Product not found.')
  }
  // The real server re-parses the path against the product and answers 422 on
  // a mismatch. The client always echoes `path` verbatim, so this only fires
  // for a hand-crafted request — but leaving it out would make the mock more
  // permissive than production.
  if (!path.startsWith(`products/${productId}/`)) {
    throw new ApiError(
      422,
      { code: 'unprocessable_entity' },
      'Path does not belong to this product.',
    )
  }
  // No object at that path: the upload never landed, or it was cancelled
  // mid-flight. This is the branch the uploader recovers from with a fresh
  // mint, and it is only reachable because the absorber's store is shared.
  const stored = getUpload(path)
  if (!stored) {
    throw new ApiError(404, { code: 'not_found' }, 'No object at that path.')
  }
  if (stored.body.byteLength === 0) {
    throw new ApiError(422, { code: 'unprocessable_entity' }, 'Empty file.')
  }
  product.imageUrl = `/api/dev/mock-upload?path=${encodeURIComponent(path)}`
  product.updatedAt = new Date().toISOString()
  return { ...product }
}

export async function setProductActiveMock(
  id: string,
  isActive: boolean,
): Promise<ProductResponseDto | null> {
  await mockDelay()
  const product = MOCK_PRODUCTS.find((p) => p.id === id)
  if (!product) return null
  product.isActive = isActive
  product.updatedAt = new Date().toISOString()
  return { ...product }
}
