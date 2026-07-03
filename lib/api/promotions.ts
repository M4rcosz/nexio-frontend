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
      next: { revalidate: 0, tags: [`promotions:${businessUnitId}`] },
    },
  )
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
