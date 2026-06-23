import { serverFetch, USE_MOCKS } from './client'
import type { AdjustInventoryRequest, InventoryItem } from './types'
import { adjustInventoryMock, listInventoryMock } from './mocks/inventory'

export async function listInventory(
  businessUnitId: string,
): Promise<InventoryItem[]> {
  if (USE_MOCKS) {
    return listInventoryMock(businessUnitId)
  }
  return serverFetch<InventoryItem[]>(`/inventory/${businessUnitId}`, {
    next: { revalidate: 0, tags: [`inventory:${businessUnitId}`] },
  })
}

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
