import { describe, it, expect } from 'vitest'
import { MAX_INVENTORY_QUANTITY } from './constants'
import { adjustInventorySchema, initInventorySchema } from './inventory'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('initInventorySchema', () => {
  it('accepts a zero quantity (opening an empty balance)', () => {
    const res = initInventorySchema.safeParse({
      productId: UUID,
      quantity: 0,
      minQuantity: 0,
      reason: 'Opening balance',
    })
    expect(res.success).toBe(true)
  })

  it('rejects a non-uuid productId', () => {
    expect(
      initInventorySchema.safeParse({
        productId: 'prod_carne_sol',
        quantity: 1,
        minQuantity: 0,
        reason: 'x',
      }).success,
    ).toBe(false)
  })

  it('rejects a quantity above the max', () => {
    expect(
      initInventorySchema.safeParse({
        productId: UUID,
        quantity: MAX_INVENTORY_QUANTITY + 1,
        minQuantity: 0,
        reason: 'x',
      }).success,
    ).toBe(false)
  })

  it('rejects a reason longer than 150 chars', () => {
    expect(
      initInventorySchema.safeParse({
        productId: UUID,
        quantity: 1,
        minQuantity: 0,
        reason: 'a'.repeat(151),
      }).success,
    ).toBe(false)
  })

  it('rejects an empty reason', () => {
    expect(
      initInventorySchema.safeParse({
        productId: UUID,
        quantity: 1,
        minQuantity: 0,
        reason: '',
      }).success,
    ).toBe(false)
  })
})

describe('adjustInventorySchema', () => {
  it('accepts a valid IN/OUT movement', () => {
    expect(
      adjustInventorySchema.safeParse({
        productId: UUID,
        type: 'IN',
        quantity: 5,
        reason: 'Restock',
      }).success,
    ).toBe(true)
  })

  it('rejects a zero quantity (a movement moves ≥1)', () => {
    expect(
      adjustInventorySchema.safeParse({
        productId: UUID,
        type: 'OUT',
        quantity: 0,
        reason: 'x',
      }).success,
    ).toBe(false)
  })

  it('rejects a quantity above the max', () => {
    expect(
      adjustInventorySchema.safeParse({
        productId: UUID,
        type: 'IN',
        quantity: MAX_INVENTORY_QUANTITY + 1,
        reason: 'x',
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid type', () => {
    expect(
      adjustInventorySchema.safeParse({
        productId: UUID,
        type: 'SIDEWAYS',
        quantity: 1,
        reason: 'x',
      }).success,
    ).toBe(false)
  })

  it('rejects a non-uuid productId', () => {
    expect(
      adjustInventorySchema.safeParse({
        productId: 'nope',
        type: 'IN',
        quantity: 1,
        reason: 'x',
      }).success,
    ).toBe(false)
  })
})
