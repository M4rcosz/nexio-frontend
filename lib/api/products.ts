import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  CreateProductRequest,
  Paginated,
  PaginationQuery,
  ProductImageContentType,
  ProductImageUploadUrl,
  ProductResponseDto,
  ProductUpdateDto,
} from './types'
import {
  confirmProductImageMock,
  createProductMock,
  getProductMock,
  listProductsMock,
  mintProductImageUploadUrlMock,
  setProductActiveMock,
  updateProductMock,
} from './mocks/products'

/** See the note on {@link confirmProductImage}. */
const CONFIRM_TIMEOUT_MS = 15_000

export async function listProducts(
  query: PaginationQuery = {},
): Promise<Paginated<ProductResponseDto>> {
  if (USE_MOCKS) {
    return listProductsMock({
      search: query.search,
      categoryId: query.categoryId,
    })
  }
  return serverFetch<Paginated<ProductResponseDto>>('/products', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
      categoryId: query.categoryId,
    },
    next: { revalidate: 60, tags: ['products'] },
  })
}

export async function getProduct(
  productId: string,
): Promise<ProductResponseDto | null> {
  if (USE_MOCKS) {
    return getProductMock(productId)
  }
  try {
    return await serverFetch<ProductResponseDto>(`/products/${productId}`, {
      next: { revalidate: 60, tags: [`product:${productId}`] },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function listProductsByBusinessUnit(
  businessUnitId: string,
  query: PaginationQuery = {},
): Promise<Paginated<ProductResponseDto>> {
  if (USE_MOCKS) {
    return listProductsMock({
      search: query.search,
      categoryId: query.categoryId,
    })
  }
  return serverFetch<Paginated<ProductResponseDto>>(
    `/products/by-business-unit/${businessUnitId}`,
    {
      query: {
        limit: query.limit,
        cursor: query.cursor,
        search: query.search,
        categoryId: query.categoryId,
      },
      next: { revalidate: 30, tags: ['menu', `menu:${businessUnitId}`] },
    },
  )
}

/** `POST /products` (ADMIN only). 409 on duplicated name. */
export async function createProduct(
  input: CreateProductRequest,
): Promise<ProductResponseDto> {
  if (USE_MOCKS) {
    return createProductMock(input)
  }
  return serverFetch<ProductResponseDto>('/products', {
    method: 'POST',
    body: input,
  })
}

/** `PATCH /products/:productId` (ADMIN). 409 on duplicated name; 404 → null. */
export async function updateProduct(
  productId: string,
  patch: ProductUpdateDto,
): Promise<ProductResponseDto | null> {
  if (USE_MOCKS) {
    return updateProductMock(productId, patch)
  }
  try {
    return await serverFetch<ProductResponseDto>(`/products/${productId}`, {
      method: 'PATCH',
      body: patch,
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /products/:productId/image/upload-url` (ADMIN/MANAGER) — step 1 of 3.
 *
 * Mints a short-lived credential for a direct browser→storage PUT. It answers
 * `201` but persists nothing: an unused mint changes nothing on the product,
 * and a mint is never reused after a failure. Rate-limited to 10/minute per
 * client, so only call it when the user has actually picked a file.
 */
export async function mintProductImageUploadUrl(
  productId: string,
  contentType: ProductImageContentType,
): Promise<ProductImageUploadUrl> {
  if (USE_MOCKS) {
    return mintProductImageUploadUrlMock(productId, contentType)
  }
  return serverFetch<ProductImageUploadUrl>(
    `/products/${productId}/image/upload-url`,
    { method: 'POST', body: { contentType } },
  )
}

/**
 * `POST /products/:productId/image/confirm` (ADMIN/MANAGER) — step 3 of 3.
 *
 * `path` must be echoed back verbatim from the mint; the server re-parses it
 * against the product and answers `422` on anything it did not shape itself.
 * Returns the full updated product — use it directly, since a refetch can race
 * the CDN and hand back a stale row.
 */
export async function confirmProductImage(
  productId: string,
  path: string,
): Promise<ProductResponseDto> {
  if (USE_MOCKS) {
    return confirmProductImageMock(productId, path)
  }
  return serverFetch<ProductResponseDto>(
    `/products/${productId}/image/confirm`,
    {
      method: 'POST',
      body: { path },
      // Confirm is the slow call in the flow: the backend inspects the stored
      // object and deletes the one it replaces. Under the default 4s bound a
      // large file over a slow storage link times out *after* the backend has
      // already published it — the client would show "try again" for an upload
      // that actually succeeded, and no revalidateTag would run.
      timeoutMs: CONFIRM_TIMEOUT_MS,
    },
  )
}

/** `PATCH /products/:productId/activate|deactivate` (ADMIN). */
export async function setProductActive(
  productId: string,
  isActive: boolean,
): Promise<ProductResponseDto | null> {
  if (USE_MOCKS) {
    return setProductActiveMock(productId, isActive)
  }
  try {
    return await serverFetch<ProductResponseDto>(
      `/products/${productId}/${isActive ? 'activate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
