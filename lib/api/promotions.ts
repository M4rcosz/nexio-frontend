import { serverFetch, serverFetchAnonymous, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  CreatePromotionRequest,
  DiscountType,
  Paginated,
  Promotion,
  PublicPromotion,
  UpdatePromotionRequest,
} from './types'
import {
  createPromotionMock,
  getPromotionMock,
  listPromotionsByBusinessUnitMock,
  listPublicPromotionsMock,
  updatePromotionMock,
} from './mocks/promotions'

export async function listPromotionsByBusinessUnit(
  businessUnitId: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<Paginated<Promotion>> {
  if (USE_MOCKS) {
    return listPromotionsByBusinessUnitMock(businessUnitId)
  }
  return serverFetch<Paginated<Promotion>>(
    `/promotions/by-business-unit/${encodeURIComponent(businessUnitId)}`,
    {
      query: { limit: query.limit, cursor: query.cursor },
      // Mirrors menu.ts/products.ts: cheap staleness is fine since every
      // mutation (create/update/activate/deactivate) already calls
      // revalidateTag on this exact tag for immediate invalidation.
      next: { revalidate: 30, tags: [`promotions:${businessUnitId}`] },
    },
  )
}

/**
 * Wire shape of the public route. `discountType` is widened to the full enum
 * on purpose: FREE_ITEM can no longer be created, but rows predating that
 * backend check can still exist in an older database, and an unexpected value
 * must be a filter rather than a runtime surprise
 * (docs/frontend-public-promotions.md §2).
 */
type PublicPromotionWire = Omit<PublicPromotion, 'discountType'> & {
  discountType: DiscountType
}

/** Only these two can be priced; anything else is dropped before it renders. */
function isRenderable(p: PublicPromotionWire): p is PublicPromotion {
  return p.discountType === 'PERCENTAGE' || p.discountType === 'FIXED_AMOUNT'
}

/**
 * `GET /promotions/public/by-business-unit/:businessUnitId` — the
 * customer-facing catalogue of what is on offer at a unit *right now*. Public:
 * no Authorization header (it is ignored upstream), so anonymous visitors and
 * logged-in customers see the same rows. The backend filters `isActive` and the
 * half-open `[startDate, endDate)` window in SQL, hence the narrower shape.
 *
 * Not the same route as {@link listPromotionsByBusinessUnit}, which is the
 * ADMIN/MANAGER back-office listing and still returns drafts and expired rows.
 */
export async function listPublicPromotions(
  businessUnitId: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<Paginated<PublicPromotion>> {
  if (USE_MOCKS) {
    return listPublicPromotionsMock(businessUnitId, query.limit)
  }
  const page = await serverFetchAnonymous<Paginated<PublicPromotionWire>>(
    `/promotions/public/by-business-unit/${encodeURIComponent(businessUnitId)}`,
    {
      // The listing is time-sensitive (a row vanishes when it expires or an
      // admin deactivates it), so this is deliberately short-lived. The tag is
      // the one every promotion mutation already revalidates, so an admin edit
      // still shows up immediately instead of after the window.
      query: { limit: query.limit, cursor: query.cursor },
      next: { revalidate: 30, tags: [`promotions:${businessUnitId}`] },
    },
  )
  // `meta` is passed through untouched: `nextCursor` is an opaque keyset token,
  // never something to parse or rebuild.
  return { ...page, data: page.data.filter(isRenderable) }
}

/**
 * Promotions of a unit that are running right now — customer-facing surfaces
 * (menu banner, checkout estimate). One page is plenty for a banner; the
 * offers are a catalogue, not a promise (only one is applied per order, and the
 * backend decides which).
 *
 * Promotional copy is decorative, so every failure degrades to "no promotions"
 * rather than breaking the page. A 429 is expected — the global throttle counts
 * per IP and covers public routes, so a shared NAT can hit it — and stays
 * quiet; anything else is logged, since it is a real bug.
 */
export async function listActivePromotions(
  businessUnitId: string,
): Promise<PublicPromotion[]> {
  try {
    const page = await listPublicPromotions(businessUnitId, { limit: 50 })
    return page.data
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) return []
    console.error('listActivePromotions: unexpected failure', {
      businessUnitId,
      err,
    })
    return []
  }
}

export async function getPromotion(
  promotionId: string,
): Promise<Promotion | null> {
  if (USE_MOCKS) {
    return getPromotionMock(promotionId)
  }
  try {
    return await serverFetch<Promotion>(
      `/promotions/${encodeURIComponent(promotionId)}`,
      { next: { revalidate: 0, tags: [`promotion:${promotionId}`] } },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function createPromotion(
  input: CreatePromotionRequest,
): Promise<Promotion> {
  if (USE_MOCKS) {
    return createPromotionMock(input)
  }
  return serverFetch<Promotion>('/promotions', {
    method: 'POST',
    body: input,
  })
}

export async function updatePromotion(
  promotionId: string,
  patch: UpdatePromotionRequest,
): Promise<Promotion | null> {
  if (USE_MOCKS) {
    return updatePromotionMock(promotionId, patch)
  }
  try {
    return await serverFetch<Promotion>(
      `/promotions/${encodeURIComponent(promotionId)}`,
      { method: 'PATCH', body: patch },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** `PATCH /promotions/:promotionId/activate|deactivate` (ADMIN/MANAGER). */
export async function setPromotionActive(
  promotionId: string,
  isActive: boolean,
): Promise<Promotion | null> {
  if (USE_MOCKS) {
    return updatePromotionMock(promotionId, { isActive })
  }
  try {
    return await serverFetch<Promotion>(
      `/promotions/${encodeURIComponent(promotionId)}/${isActive ? 'activate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
