// TODO: backend not implemented yet — using mock data (also acts as fallback
// when the real backend is offline).
//
// Dish names stay in Portuguese on purpose: they are proper nouns of Brazilian
// cuisine and a real menu would print them as-is, even on an English UI.
import type { Paginated, ProductResponseDto } from '@/lib/api/types'
import { mockDelay } from './_delay'

const NOW = new Date().toISOString()

export const MOCK_PRODUCTS: ProductResponseDto[] = [
  {
    id: 'prod_carne_sol',
    name: 'Carne de sol com macaxeira',
    description: 'Grilled sun-dried beef served with fried cassava, clarified butter and grilled coalho cheese.',
    price: 58.9,
    isActive: true,
    categoryId: 'cat_carnes',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'prod_baiao',
    name: 'Baião de dois',
    description: 'Rice with green beans, coalho cheese, shredded dried beef and cilantro.',
    price: 42.0,
    isActive: true,
    categoryId: 'cat_acompanhamentos',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'prod_bode',
    name: 'Bode guisado',
    description: 'Slow-cooked goat stew served with cassava purée and rice.',
    price: 67.5,
    isActive: true,
    categoryId: 'cat_carnes',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'prod_queijo_coalho',
    name: 'Queijo coalho na brasa',
    description: 'Coalho cheese skewers grilled over embers, drizzled with cane molasses.',
    price: 28.0,
    isActive: true,
    categoryId: 'cat_petiscos',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'prod_caldo_cana',
    name: 'Caldo de cana 500ml',
    description: 'Fresh sugarcane juice with lime.',
    price: 9.5,
    isActive: true,
    categoryId: 'cat_bebidas',
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'prod_bolo_rolo',
    name: 'Bolo de rolo',
    description: 'Generous slice of bolo de rolo with creamy guava paste.',
    price: 16.0,
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

export async function getProductMock(id: string): Promise<ProductResponseDto | null> {
  await mockDelay()
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null
}
