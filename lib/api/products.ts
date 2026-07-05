import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  CreateProductRequest,
  Paginated,
  PaginationQuery,
  ProductResponseDto,
  ProductUpdateDto,
} from './types'
import {
  createProductMock,
  getProductMock,
  listProductsMock,
  setProductActiveMock,
  updateProductMock,
} from './mocks/products'

export async function listProducts(
  query: PaginationQuery = {},
): Promise<Paginated<ProductResponseDto>> {
  if (USE_MOCKS) {
    return listProductsMock({ search: query.search, categoryId: query.categoryId })
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
    return listProductsMock({ search: query.search, categoryId: query.categoryId })
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
      next: { revalidate: 30, tags: [`menu:${businessUnitId}`] },
    },
  )
}

/** `POST /products` (ADMIN/MANAGER). 409 on duplicated name. */
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
