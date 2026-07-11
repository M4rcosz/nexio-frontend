import { z } from 'zod'
import { MAX_INVENTORY_QUANTITY, REASON_MAX_LENGTH } from './constants'

const productId = z.string().uuid()
const reason = z.string().min(1).max(REASON_MAX_LENGTH)

/**
 * `POST /inventory/:businessUnitId/items` body. Creates the first stock row for
 * a product at a unit — quantity may be 0 (open a balance without stock).
 */
export const initInventorySchema = z.object({
  productId,
  quantity: z.number().int().min(0).max(MAX_INVENTORY_QUANTITY),
  minQuantity: z.number().int().min(0).max(MAX_INVENTORY_QUANTITY),
  reason,
})

/**
 * `POST /inventory/:businessUnitId/adjust` body. A movement always moves at
 * least one unit, so quantity is ≥1 here (0 is rejected).
 */
export const adjustInventorySchema = z.object({
  productId,
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().min(1).max(MAX_INVENTORY_QUANTITY),
  reason,
})

export type InitInventoryInput = z.infer<typeof initInventorySchema>
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>
