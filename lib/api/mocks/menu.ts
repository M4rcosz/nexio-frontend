// Mock fallback for the `/business-units/:businessUnitId/menu` endpoints.
//
// Every seeded unit carries the full product catalog with a small price
// variation so the "effective unit price" behavior is visible in the UI.
import type {
  AddMenuItemRequest,
  MenuItem,
  Paginated,
  PublicMenuItem,
  UpdateMenuItemRequest,
} from '@/lib/api/types'
import { MOCK_BUSINESS_UNITS } from './business-units'
import { MOCK_PRODUCTS } from './products'
import { asMoney } from '@/lib/money'
import { mockDelay } from './_delay'

const NOW = new Date().toISOString()

function seed(): MenuItem[] {
  const items: MenuItem[] = []
  MOCK_BUSINESS_UNITS.forEach((unit, unitIdx) => {
    MOCK_PRODUCTS.forEach((product, productIdx) => {
      items.push({
        id: `mi_${unit.id}_${product.id}`,
        businessUnitId: unit.id,
        productId: product.id,
        // Slight per-unit variation over the catalog price (+0.50 per unit idx).
        customPrice: asMoney(product.price).plus(unitIdx * 0.5).toFixed(2),
        // One item per unit is left unavailable to exercise the manage view.
        isAvailable: productIdx !== MOCK_PRODUCTS.length - 1,
        createdAt: NOW,
        updatedAt: NOW,
      })
    })
  })
  return items
}

const STORE: MenuItem[] = seed()

function toPublic(item: MenuItem): PublicMenuItem | null {
  const product = MOCK_PRODUCTS.find((p) => p.id === item.productId)
  if (!product) return null
  return {
    menuItemId: item.id,
    productId: item.productId,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    price: item.customPrice,
  }
}

export async function listMenuMock(
  businessUnitId: string,
): Promise<Paginated<PublicMenuItem>> {
  await mockDelay()
  const data = STORE.filter(
    (i) => i.businessUnitId === businessUnitId && i.isAvailable,
  )
    .map(toPublic)
    .filter((i): i is PublicMenuItem => i !== null)
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function getMenuItemMock(
  businessUnitId: string,
  menuItemId: string,
): Promise<PublicMenuItem | null> {
  await mockDelay()
  const item = STORE.find(
    (i) =>
      i.id === menuItemId &&
      i.businessUnitId === businessUnitId &&
      i.isAvailable,
  )
  return item ? toPublic(item) : null
}

export async function listMenuManageMock(
  businessUnitId: string,
): Promise<Paginated<MenuItem>> {
  await mockDelay()
  const data = STORE.filter((i) => i.businessUnitId === businessUnitId).map(
    (i) => ({ ...i }),
  )
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function addMenuItemMock(
  businessUnitId: string,
  input: AddMenuItemRequest,
): Promise<MenuItem> {
  await mockDelay()
  if (
    STORE.some(
      (i) => i.businessUnitId === businessUnitId && i.productId === input.productId,
    )
  ) {
    throw Object.assign(new Error('Product already on the menu.'), {
      code: 'already_exists',
    })
  }
  const now = new Date().toISOString()
  const item: MenuItem = {
    id: `mi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    businessUnitId,
    productId: input.productId,
    customPrice: input.customPrice,
    isAvailable: input.isAvailable ?? true,
    createdAt: now,
    updatedAt: now,
  }
  STORE.push(item)
  return { ...item }
}

export async function updateMenuItemMock(
  businessUnitId: string,
  menuItemId: string,
  patch: UpdateMenuItemRequest,
): Promise<MenuItem | null> {
  await mockDelay()
  const item = STORE.find(
    (i) => i.id === menuItemId && i.businessUnitId === businessUnitId,
  )
  if (!item) return null
  if (patch.customPrice !== undefined) item.customPrice = patch.customPrice
  if (patch.isAvailable !== undefined) item.isAvailable = patch.isAvailable
  item.updatedAt = new Date().toISOString()
  return { ...item }
}
