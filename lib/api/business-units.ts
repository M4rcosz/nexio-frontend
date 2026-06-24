// All reads follow the live-with-toggle pattern: they hit the real backend,
// falling back to the mock only when USE_MOCKS is enabled. The public reads
// (`listBusinessUnits` / `getBusinessUnit`) consume the anonymous endpoints
// `GET /business-units` and `GET /business-units/:id` (active-only public view);
// the internal listing consumes the authenticated `GET /business-units/internal`.
import { serverFetch, serverFetchAnonymous, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type { BusinessUnit, Paginated } from './types'
import {
  getBusinessUnit as getBusinessUnitMock,
  listBusinessUnits as listBusinessUnitsMock,
  listBusinessUnitsInternalMock,
} from './mocks/business-units'

export type ListBusinessUnitsQuery = {
  limit?: number
  cursor?: string
  search?: string
  city?: string
}

/**
 * Public, active-only unit listing. Consumes `GET /business-units`
 * (cursor-paginated, no auth). Supports `search`/`city` filters.
 */
export async function listBusinessUnits(
  query: ListBusinessUnitsQuery = {},
): Promise<Paginated<BusinessUnit>> {
  if (USE_MOCKS) {
    return listBusinessUnitsMock({ search: query.search, city: query.city })
  }
  return serverFetchAnonymous<Paginated<BusinessUnit>>('/business-units', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
      city: query.city,
    },
    next: { revalidate: 30, tags: ['business-units'] },
  })
}

/**
 * Public single-unit read. Consumes `GET /business-units/:id`; returns `null`
 * when the unit is missing or inactive (the backend answers `404` for both).
 */
export async function getBusinessUnit(
  id: string,
): Promise<BusinessUnit | null> {
  if (USE_MOCKS) {
    return getBusinessUnitMock(id)
  }
  try {
    return await serverFetchAnonymous<BusinessUnit>(`/business-units/${id}`, {
      next: { revalidate: 30, tags: ['business-units', `business-units:${id}`] },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
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
