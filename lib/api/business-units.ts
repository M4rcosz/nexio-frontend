// The public reads (`listBusinessUnits` / `getBusinessUnit`) are still mock-only
// — the backend does not expose them in this app's flow. The internal listing
// follows the live-with-toggle pattern: it hits the real backend, falling back
// to the mock only when USE_MOCKS is enabled.
import { serverFetch, USE_MOCKS } from './client'
import type { BusinessUnit, Paginated } from './types'
import {
  getBusinessUnit as getBusinessUnitMock,
  listBusinessUnits as listBusinessUnitsMock,
  listBusinessUnitsInternalMock,
} from './mocks/business-units'

export async function listBusinessUnits(): Promise<Paginated<BusinessUnit>> {
  return listBusinessUnitsMock()
}

export async function getBusinessUnit(
  id: string,
): Promise<BusinessUnit | null> {
  return getBusinessUnitMock(id)
}

export type ListBusinessUnitsInternalQuery = {
  limit?: number
  cursor?: string
  search?: string
  city?: string
  isActive?: boolean
}

/**
 * Full unit listing (includes inactive units) for the ADMIN unit selector.
 * Consumes `GET /api/business-units/internal` (cursor-paginated).
 */
export async function listBusinessUnitsInternal(
  query: ListBusinessUnitsInternalQuery = {},
): Promise<Paginated<BusinessUnit>> {
  if (USE_MOCKS) {
    return listBusinessUnitsInternalMock({
      search: query.search,
      city: query.city,
      isActive: query.isActive,
    })
  }
  return serverFetch<Paginated<BusinessUnit>>('/business-units/internal', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
      city: query.city,
      isActive:
        typeof query.isActive === 'boolean' ? String(query.isActive) : undefined,
    },
    next: { revalidate: 30, tags: ['business-units:internal'] },
  })
}
