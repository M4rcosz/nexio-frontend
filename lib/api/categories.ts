// [stub] backend does not implement /categories yet — always uses mock.
import type { Category, Paginated } from './types'
import { listCategories as listCategoriesMock } from './mocks/categories'

export async function listCategories(): Promise<Paginated<Category>> {
  return listCategoriesMock()
}
