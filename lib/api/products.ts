import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type { Paginated, PaginationQuery, ProductResponseDto } from './types'
import {
  getProductMock,
  listProductsMock,
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
