import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  Category,
  CreateCategoryRequest,
  ListCategoriesQuery,
  Paginated,
  UpdateCategoryRequest,
} from './types'
import {
  createCategoryMock,
  getCategoryMock,
  listCategoriesMock,
  updateCategoryMock,
} from './mocks/categories'

/** `GET /categories` (public) — only active categories, cursor-paginated. */
export async function listCategories(
  query: ListCategoriesQuery = {},
): Promise<Paginated<Category>> {
  if (USE_MOCKS) {
    return listCategoriesMock(query)
  }
  return serverFetch<Paginated<Category>>('/categories', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
    },
    next: { revalidate: 60, tags: ['categories'] },
  })
}

/** `GET /categories/:id` (public) — returns the category even when inactive; 404 → null. */
export async function getCategory(id: string): Promise<Category | null> {
  if (USE_MOCKS) {
    return getCategoryMock(id)
  }
  try {
    return await serverFetch<Category>(`/categories/${id}`, {
      next: { revalidate: 60, tags: [`category:${id}`] },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** `POST /categories` (ADMIN). 409 on duplicated name. Born active. */
export async function createCategory(
  input: CreateCategoryRequest,
): Promise<Category> {
  if (USE_MOCKS) {
    return createCategoryMock(input)
  }
  return serverFetch<Category>('/categories', {
    method: 'POST',
    body: input,
  })
}

/** `PATCH /categories/:id` (ADMIN). 409 on duplicated name; 404 → null. */
export async function updateCategory(
  id: string,
  patch: UpdateCategoryRequest,
): Promise<Category | null> {
  if (USE_MOCKS) {
    return updateCategoryMock(id, patch)
  }
  try {
    return await serverFetch<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: patch,
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
