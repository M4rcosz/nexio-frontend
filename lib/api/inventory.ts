import { serverFetch, USE_MOCKS } from './client'
import type {
  AdjustInventoryRequest,
  InitInventoryRequest,
  InventoryItem,
  Paginated,
} from './types'
import {
  adjustInventoryMock,
  initInventoryMock,
  listInventoryMock,
} from './mocks/inventory'

export type ListInventoryQuery = {
  limit?: number
  cursor?: string
}

/**
 * `GET /inventory/:businessUnitId` (MANAGER/ADMIN, unit-scoped) —
 * cursor-paginated stock balances of a unit.
 */
export async function listInventory(
  businessUnitId: string,
  query: ListInventoryQuery = {},
): Promise<Paginated<InventoryItem>> {
  if (USE_MOCKS) {
    return listInventoryMock(businessUnitId)
  }
  return serverFetch<Paginated<InventoryItem>>(`/inventory/${businessUnitId}`, {
    query: { limit: query.limit, cursor: query.cursor },
    next: { revalidate: 0, tags: [`inventory:${businessUnitId}`] },
  })
}

/**
 * `POST /inventory/:businessUnitId/adjust` — manual IN/OUT movement.
 * 404 when an IN targets a product without a stock row; 422 when an OUT
 * would drive the balance below zero.
 */
export async function adjustInventory(
  businessUnitId: string,
  input: AdjustInventoryRequest,
): Promise<InventoryItem> {
  if (USE_MOCKS) {
    return adjustInventoryMock(businessUnitId, input)
  }
  return serverFetch<InventoryItem>(`/inventory/${businessUnitId}/adjust`, {
    method: 'POST',
    body: input,
  })
}

/**
 * `POST /inventory/:businessUnitId/items` — opens the first stock row for a
 * product at a unit. 409 when a row already exists; 404 when the product does
 * not belong to the unit's menu.
 */
export async function initInventory(
  businessUnitId: string,
  input: InitInventoryRequest,
): Promise<InventoryItem> {
  if (USE_MOCKS) {
    return initInventoryMock(businessUnitId, input)
  }
  return serverFetch<InventoryItem>(`/inventory/${businessUnitId}/items`, {
    method: 'POST',
    body: input,
  })
}
