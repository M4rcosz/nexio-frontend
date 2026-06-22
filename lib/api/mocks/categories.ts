// TODO: backend not implemented yet — using mock data
import type { Category, Paginated } from '@/lib/api/types'
import { mockDelay } from './_delay'

// Category and dish names stay in Portuguese on purpose — they are proper
// nouns of Brazilian cuisine (e.g. "Carne de sol", "Baião de dois") and
// would not be translated in a real menu, even on an English UI.
export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat_carnes', name: 'Carnes', description: 'Dishes with carne de sol, goat, chicken' },
  { id: 'cat_acompanhamentos', name: 'Acompanhamentos', description: 'Cassava, baião, farofa and other side dishes' },
  { id: 'cat_petiscos', name: 'Petiscos', description: 'Bar-style snacks to share' },
  { id: 'cat_bebidas', name: 'Bebidas', description: 'Juices, sodas, beers' },
  { id: 'cat_sobremesas', name: 'Sobremesas', description: 'Cocada, dulce de leche, bolo de rolo' },
]

export async function listCategories(): Promise<Paginated<Category>> {
  await mockDelay()
  return {
    data: MOCK_CATEGORIES,
    meta: { limit: 20, nextCursor: null, hasMore: false },
  }
}
