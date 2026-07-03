// All reads follow the live-with-toggle pattern: they hit the real backend,
// falling back to the mock only when USE_MOCKS is enabled. The public reads
// (`listBusinessUnits` / `getBusinessUnit`) consume the anonymous endpoints
// `GET /business-units` and `GET /business-units/:id`, which return the
// active-only PUBLIC view (no cnpj/isActive/timestamps); the `internal`
// endpoints (ADMIN/MANAGER) return the full detail, inactive units included.
import { serverFetch, serverFetchAnonymous, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  BusinessUnit,
  CreateBusinessUnitRequest,
  Paginated,
  PublicBusinessUnit,
} from './types'
import {
  createBusinessUnitMock,
  getBusinessUnitInternalMock,
  getBusinessUnitMock,
  listBusinessUnitsInternalMock,
  listBusinessUnitsMock,
  setBusinessUnitActiveMock,
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
): Promise<Paginated<PublicBusinessUnit>> {
  if (USE_MOCKS) {
    return listBusinessUnitsMock({ search: query.search, city: query.city })
  }
  return serverFetchAnonymous<Paginated<PublicBusinessUnit>>('/business-units', {
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
): Promise<PublicBusinessUnit | null> {
  if (USE_MOCKS) {
    return getBusinessUnitMock(id)
  }
  try {
    return await serverFetchAnonymous<PublicBusinessUnit>(`/business-units/${id}`, {
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
 * Consumes `GET /business-units/internal` (cursor-paginated, ADMIN/MANAGER).
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

/**
 * Full single-unit read, inactive included. Consumes
 * `GET /business-units/internal/:id` (ADMIN/MANAGER).
 */
export async function getBusinessUnitInternal(
  id: string,
): Promise<BusinessUnit | null> {
  if (USE_MOCKS) {
    return getBusinessUnitInternalMock(id)
  }
  try {
    return await serverFetch<BusinessUnit>(`/business-units/internal/${id}`, {
      next: { revalidate: 30, tags: ['business-units:internal', `business-units:${id}`] },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** `POST /business-units` (ADMIN). 409 on duplicated cnpj/phone. */
export async function createBusinessUnit(
  input: CreateBusinessUnitRequest,
): Promise<BusinessUnit> {
  if (USE_MOCKS) {
    return createBusinessUnitMock(input)
  }
  return serverFetch<BusinessUnit>('/business-units', {
    method: 'POST',
    body: input,
  })
}

/** `PATCH /business-units/:id/activate|deactivate` (ADMIN). */
export async function setBusinessUnitActive(
  id: string,
  isActive: boolean,
): Promise<BusinessUnit | null> {
  if (USE_MOCKS) {
    return setBusinessUnitActiveMock(id, isActive)
  }
  try {
    return await serverFetch<BusinessUnit>(
      `/business-units/${id}/${isActive ? 'activate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
