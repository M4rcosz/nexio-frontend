// Mock fallback for the `/categories` endpoints (USE_MOCKS only).
//
// Category names stay in Portuguese on purpose — they are proper nouns of
// Brazilian cuisine (e.g. "Carne de sol", "Baião de dois") and would not be
// translated in a real menu, even on an English UI.
import type {
  Category,
  CreateCategoryRequest,
  ListCategoriesQuery,
  Paginated,
  UpdateCategoryRequest,
} from '@/lib/api/types'
import { ApiError } from '@/lib/api/errors'
import { mockDelay } from './_delay'

const NOW = new Date().toISOString()

/** Internal store — mutated by create/update. */
export const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat_carnes',
    name: 'Carnes',
    description: 'Dishes with carne de sol, goat, chicken',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cat_acompanhamentos',
    name: 'Acompanhamentos',
    description: 'Cassava, baião, farofa and other side dishes',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cat_petiscos',
    name: 'Petiscos',
    description: 'Bar-style snacks to share',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cat_bebidas',
    name: 'Bebidas',
    description: 'Juices, sodas, beers',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cat_sobremesas',
    name: 'Sobremesas',
    description: 'Cocada, dulce de leche, bolo de rolo',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

function newId(): string {
  return `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** `GET /categories` — only active, honours search/limit/cursor. */
export async function listCategoriesMock(
  query: ListCategoriesQuery = {},
): Promise<Paginated<Category>> {
  await mockDelay()
  let data = MOCK_CATEGORIES.filter((c) => c.isActive)
  if (query.search) {
    const term = query.search.toLowerCase()
    data = data.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.description ?? '').toLowerCase().includes(term),
    )
  }
  const limit = query.limit ?? 20
  let start = 0
  if (query.cursor) {
    const idx = data.findIndex((c) => c.id === query.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = data.slice(start, start + limit).map((c) => ({ ...c }))
  const hasMore = start + limit < data.length
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null
  return { data: page, meta: { limit, nextCursor, hasMore } }
}

/** `GET /categories/:id` — returns the category even when inactive. */
export async function getCategoryMock(id: string): Promise<Category | null> {
  await mockDelay()
  const found = MOCK_CATEGORIES.find((c) => c.id === id)
  return found ? { ...found } : null
}

/** `POST /categories` — born active; 409 on duplicated name. */
export async function createCategoryMock(
  input: CreateCategoryRequest,
): Promise<Category> {
  await mockDelay()
  if (
    MOCK_CATEGORIES.some(
      (c) => c.name.toLowerCase() === input.name.toLowerCase(),
    )
  ) {
    throw new ApiError(409, { code: 'name_taken' }, 'Name already in use.')
  }
  const now = new Date().toISOString()
  const category: Category = {
    id: newId(),
    name: input.name,
    description: input.description ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  MOCK_CATEGORIES.push(category)
  return { ...category }
}

/** `PATCH /categories/:id` — partial update; 409 on duplicated name; 404 → null. */
export async function updateCategoryMock(
  id: string,
  patch: UpdateCategoryRequest,
): Promise<Category | null> {
  await mockDelay()
  const category = MOCK_CATEGORIES.find((c) => c.id === id)
  if (!category) return null
  if (
    patch.name !== undefined &&
    MOCK_CATEGORIES.some(
      (c) => c.id !== id && c.name.toLowerCase() === patch.name!.toLowerCase(),
    )
  ) {
    throw new ApiError(409, { code: 'name_taken' }, 'Name already in use.')
  }
  if (patch.name !== undefined) category.name = patch.name
  if (patch.description !== undefined) category.description = patch.description
  if (patch.isActive !== undefined) category.isActive = patch.isActive
  category.updatedAt = new Date().toISOString()
  return { ...category }
}
