// Per-unit menu: product + effective unit price
// (`/business-units/:businessUnitId/menu`).
//
// The public reads return the PUBLIC view (available items only, flattened
// product info + effective `price`); the `manage` listing (ADMIN/MANAGER,
// unit-scoped) returns the raw MenuItem including unavailable entries.
import { serverFetch, serverFetchAnonymous, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  AddMenuItemRequest,
  MenuItem,
  Paginated,
  PublicMenuItem,
  UpdateMenuItemRequest,
} from './types'
import {
  addMenuItemMock,
  getMenuItemMock,
  listMenuManageMock,
  listMenuMock,
  updateMenuItemMock,
} from './mocks/menu'

export type ListMenuQuery = {
  limit?: number
  cursor?: string
}

/**
 * Public, available-only menu of a unit. Consumes
 * `GET /business-units/:businessUnitId/menu` (cursor-paginated, no auth).
 */
export async function listMenu(
  businessUnitId: string,
  query: ListMenuQuery = {},
): Promise<Paginated<PublicMenuItem>> {
  if (USE_MOCKS) {
    return listMenuMock(businessUnitId)
  }
  return serverFetchAnonymous<Paginated<PublicMenuItem>>(
    `/business-units/${businessUnitId}/menu`,
    {
      query: { limit: query.limit, cursor: query.cursor },
      next: { revalidate: 30, tags: [`menu:${businessUnitId}`] },
    },
  )
}

/**
 * Public single-item read. Consumes
 * `GET /business-units/:businessUnitId/menu/:menuItemId`; `null` when the item
 * is missing or unavailable (backend answers 404 for both).
 */
export async function getMenuItem(
  businessUnitId: string,
  menuItemId: string,
): Promise<PublicMenuItem | null> {
  if (USE_MOCKS) {
    return getMenuItemMock(businessUnitId, menuItemId)
  }
  try {
    return await serverFetchAnonymous<PublicMenuItem>(
      `/business-units/${businessUnitId}/menu/${menuItemId}`,
      { next: { revalidate: 30, tags: [`menu:${businessUnitId}`] } },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * Management listing including unavailable items. Consumes
 * `GET /business-units/:businessUnitId/menu/manage` (ADMIN/MANAGER,
 * unit-scoped).
 */
export async function listMenuManage(
  businessUnitId: string,
  query: ListMenuQuery = {},
): Promise<Paginated<MenuItem>> {
  if (USE_MOCKS) {
    return listMenuManageMock(businessUnitId)
  }
  return serverFetch<Paginated<MenuItem>>(
    `/business-units/${businessUnitId}/menu/manage`,
    {
      query: { limit: query.limit, cursor: query.cursor },
      cache: 'no-store',
    },
  )
}

/**
 * `POST /business-units/:businessUnitId/menu` (ADMIN/MANAGER, unit-scoped).
 * 409 when the product is already on the menu.
 */
export async function addMenuItem(
  businessUnitId: string,
  input: AddMenuItemRequest,
): Promise<MenuItem> {
  if (USE_MOCKS) {
    return addMenuItemMock(businessUnitId, input)
  }
  return serverFetch<MenuItem>(`/business-units/${businessUnitId}/menu`, {
    method: 'POST',
    body: input,
  })
}

/**
 * `PATCH /business-units/:businessUnitId/menu/:menuItemId` — price and/or
 * availability (at least one field).
 */
export async function updateMenuItem(
  businessUnitId: string,
  menuItemId: string,
  patch: UpdateMenuItemRequest,
): Promise<MenuItem | null> {
  if (USE_MOCKS) {
    return updateMenuItemMock(businessUnitId, menuItemId, patch)
  }
  try {
    return await serverFetch<MenuItem>(
      `/business-units/${businessUnitId}/menu/${menuItemId}`,
      { method: 'PATCH', body: patch },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `PATCH /business-units/:businessUnitId/menu/:menuItemId/activate|deactivate`
 * — toggles `isAvailable`.
 */
export async function setMenuItemAvailable(
  businessUnitId: string,
  menuItemId: string,
  isAvailable: boolean,
): Promise<MenuItem | null> {
  if (USE_MOCKS) {
    return updateMenuItemMock(businessUnitId, menuItemId, { isAvailable })
  }
  try {
    return await serverFetch<MenuItem>(
      `/business-units/${businessUnitId}/menu/${menuItemId}/${isAvailable ? 'activate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
