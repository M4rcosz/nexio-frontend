// TODO: backend not implemented yet — used only when USE_MOCKS is enabled.
//
// In-memory promotions store. Money fields are decimal strings, mirroring the
// real API. FREE_ITEM is never produced here (the schema does not model it).
import type {
  CreatePromotionRequest,
  Paginated,
  Promotion,
  UpdatePromotionRequest,
} from '@/lib/api/types'
import { mockDelay } from './_delay'
import { MOCK_BUSINESS_UNITS } from './business-units'

const NOW = new Date().toISOString()

function makePromotion(
  id: string,
  businessUnitId: string,
  name: string,
  discountType: Promotion['discountType'],
  discountValue: string,
  minOrderValue: string,
  isActive = true,
): Promotion {
  const start = new Date('2026-06-01T00:00:00.000Z').toISOString()
  const end = new Date('2026-12-31T23:59:59.000Z').toISOString()
  return {
    id,
    businessUnitId,
    name,
    discountType,
    discountValue,
    minOrderValue,
    startDate: start,
    endDate: end,
    isActive,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

/** Internal store — mutated by create/update. Seeded with realistic data. */
const STORE: Promotion[] = [
  makePromotion(
    'promo_almoco_recife',
    MOCK_BUSINESS_UNITS[0].id,
    'Almoço executivo',
    'PERCENTAGE',
    '10.00',
    '30.00',
  ),
  makePromotion(
    'promo_combo_recife',
    MOCK_BUSINESS_UNITS[0].id,
    'Combo família',
    'FIXED_AMOUNT',
    '15.00',
    '120.00',
  ),
  makePromotion(
    'promo_carmo_olinda',
    MOCK_BUSINESS_UNITS[1].id,
    'Tarde no Carmo',
    'PERCENTAGE',
    '8.00',
    '25.00',
    false,
  ),
]

function newId(prefix = 'promo'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export async function listPromotionsByBusinessUnitMock(
  businessUnitId: string,
): Promise<Paginated<Promotion>> {
  await mockDelay()
  const data = STORE.filter((p) => p.businessUnitId === businessUnitId).map(
    (p) => ({ ...p }),
  )
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function getPromotionMock(
  promotionId: string,
): Promise<Promotion | null> {
  await mockDelay()
  const found = STORE.find((p) => p.id === promotionId)
  return found ? { ...found } : null
}

export async function createPromotionMock(
  input: CreatePromotionRequest,
): Promise<Promotion> {
  await mockDelay()
  const promotion: Promotion = {
    id: newId(),
    businessUnitId: input.businessUnitId,
    name: input.name,
    discountType: input.discountType,
    discountValue: input.discountValue,
    minOrderValue: input.minOrderValue,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  STORE.push(promotion)
  return { ...promotion }
}

export async function updatePromotionMock(
  promotionId: string,
  patch: UpdatePromotionRequest,
): Promise<Promotion | null> {
  await mockDelay()
  const idx = STORE.findIndex((p) => p.id === promotionId)
  if (idx < 0) return null
  STORE[idx] = {
    ...STORE[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  return { ...STORE[idx] }
}
