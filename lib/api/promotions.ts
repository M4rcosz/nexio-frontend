import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  CreatePromotionRequest,
  Paginated,
  Promotion,
  UpdatePromotionRequest,
} from './types'
import {
  createPromotionMock,
  getPromotionMock,
  listPromotionsByBusinessUnitMock,
  updatePromotionMock,
} from './mocks/promotions'
import { isPromotionLive } from '@/lib/promotions'

export async function listPromotionsByBusinessUnit(
  businessUnitId: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<Paginated<Promotion>> {
  if (USE_MOCKS) {
    return listPromotionsByBusinessUnitMock(businessUnitId)
  }
  return serverFetch<Paginated<Promotion>>(
    `/promotions/by-business-unit/${businessUnitId}`,
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
 * Promotions of a unit that are running right now — customer-facing surfaces
 * (menu banner, checkout estimate). The backend currently restricts the
 * promotions endpoints to ADMIN/MANAGER, so for a customer or anonymous
 * session this fails with 401/403: promotional copy is decorative, so that
 * specific failure degrades to "no promotions" instead of breaking the page.
 * In mock mode (and once the backend exposes a public read) the data flows
 * through. Any other failure (5xx, timeout, malformed response) is logged
 * instead of swallowed — those are real bugs, not the known role gap.
 */
export async function listActivePromotions(
  businessUnitId: string,
): Promise<Promotion[]> {
  try {
    const page = await listPromotionsByBusinessUnit(businessUnitId, {
      limit: 50,
    })
    return page.data.filter((p) => isPromotionLive(p))
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return []
    }
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
    return await serverFetch<Promotion>(`/promotions/${promotionId}`, {
      next: { revalidate: 0, tags: [`promotion:${promotionId}`] },
    })
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
    return await serverFetch<Promotion>(`/promotions/${promotionId}`, {
      method: 'PATCH',
      body: patch,
    })
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
      `/promotions/${promotionId}/${isActive ? 'activate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
