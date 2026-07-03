// Mock fallback for the `/inventory` endpoints (USE_MOCKS only).
//
// In-memory inventory store keyed by `${businessUnitId}:${productId}`, seeded
// from the product catalog so every unit starts with a stock balance for each
// product. Adjustments mutate the store, mirroring the backend rules: an `IN`
// for a product without a stock row 404s, an `OUT` below zero 422s.
import type {
  AdjustInventoryRequest,
  InventoryItem,
  Paginated,
} from '@/lib/api/types'
import { mockDelay } from './_delay'
import { MOCK_PRODUCTS } from './products'
import { MOCK_BUSINESS_UNITS } from './business-units'

const NOW = new Date().toISOString()

function keyOf(businessUnitId: string, productId: string): string {
  return `${businessUnitId}:${productId}`
}

/** Internal store — mutated by adjustments. Seeded with realistic balances. */
const STORE = new Map<string, InventoryItem>()

function seed(): void {
  if (STORE.size > 0) return
  let n = 0
  for (const unit of MOCK_BUSINESS_UNITS) {
    for (const product of MOCK_PRODUCTS) {
      n += 1
      STORE.set(keyOf(unit.id, product.id), {
        id: `inv_${n.toString(36)}`,
        businessUnitId: unit.id,
        productId: product.id,
        quantity: 40 + ((n * 7) % 60),
        minQuantity: 5,
        updatedAt: NOW,
      })
    }
  }
}

export async function listInventoryMock(
  businessUnitId: string,
): Promise<Paginated<InventoryItem>> {
  await mockDelay()
  seed()
  const data = Array.from(STORE.values())
    .filter((i) => i.businessUnitId === businessUnitId)
    .map((i) => ({ ...i }))
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function adjustInventoryMock(
  businessUnitId: string,
  input: AdjustInventoryRequest,
): Promise<InventoryItem> {
  await mockDelay()
  seed()
  const key = keyOf(businessUnitId, input.productId)
  const existing = STORE.get(key)

  if (input.type === 'IN' && !existing) {
    throw Object.assign(
      new Error('No stock row exists for this product at the unit.'),
      { code: 'inventory_not_found' },
    )
  }
  const current = existing ?? {
    id: `inv_${Date.now().toString(36)}`,
    businessUnitId,
    productId: input.productId,
    quantity: 0,
    minQuantity: 5,
    updatedAt: NOW,
  }
  const delta = input.type === 'IN' ? input.quantity : -input.quantity
  const next = current.quantity + delta
  if (next < 0) {
    throw Object.assign(
      new Error('The adjustment would drive the balance below zero.'),
      { code: 'inventory_below_zero' },
    )
  }
  const updated: InventoryItem = {
    ...current,
    quantity: next,
    updatedAt: new Date().toISOString(),
  }
  STORE.set(key, updated)
  return { ...updated }
}
