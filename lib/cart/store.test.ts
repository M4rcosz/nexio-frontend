import { describe, it, expect, vi, beforeEach } from 'vitest'

// The store persists via zustand's `createJSONStorage(() => localStorage)`,
// which is touched at import time. The `node` test env has no localStorage, so
// install an in-memory stub before the store module is hoisted/imported.
vi.hoisted(() => {
  const mem = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

import { useCartStore, cartTotal, cartCount, type CartItem } from './store'

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    name: 'Burger',
    unitPrice: '25.90',
    imageUrl: null,
    quantity: 1,
    notes: null,
    ...over,
  }
}

beforeEach(() => {
  useCartStore.getState().clear()
})

describe('cartTotal', () => {
  it('is zero for an empty cart', () => {
    expect(cartTotal([]).toString()).toBe('0')
  })

  it('sums unitPrice * quantity with money precision', () => {
    const items = [
      item({ productId: 'p1', unitPrice: '25.90', quantity: 2 }),
      item({ productId: 'p2', unitPrice: '10.05', quantity: 3 }),
    ]
    // 51.80 + 30.15 = 81.95 — no float drift.
    expect(cartTotal(items).toString()).toBe('81.95')
  })
})

describe('cartCount', () => {
  it('sums the quantities across lines', () => {
    expect(
      cartCount([
        item({ quantity: 2 }),
        item({ productId: 'p2', quantity: 5 }),
      ]),
    ).toBe(7)
  })
})

describe('useCartStore.addItem', () => {
  it('adds a new line with a default quantity of 1', () => {
    useCartStore.getState().addItem({
      productId: 'p1',
      name: 'Burger',
      unitPrice: '25.90',
      imageUrl: null,
    })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      productId: 'p1',
      quantity: 1,
      notes: null,
    })
  })

  it('merges quantity into an existing line instead of duplicating it', () => {
    const { addItem } = useCartStore.getState()
    addItem({
      productId: 'p1',
      name: 'Burger',
      unitPrice: '25.90',
      imageUrl: null,
      quantity: 2,
    })
    addItem({
      productId: 'p1',
      name: 'Burger',
      unitPrice: '25.90',
      imageUrl: null,
      quantity: 3,
    })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(5)
  })
})

describe('useCartStore.setQuantity', () => {
  it('updates the quantity of a line', () => {
    useCartStore
      .getState()
      .addItem({
        productId: 'p1',
        name: 'B',
        unitPrice: '1.00',
        imageUrl: null,
      })
    useCartStore.getState().setQuantity('p1', 4)
    expect(useCartStore.getState().items[0].quantity).toBe(4)
  })

  it('removes the line when quantity drops to 0 or below', () => {
    useCartStore
      .getState()
      .addItem({
        productId: 'p1',
        name: 'B',
        unitPrice: '1.00',
        imageUrl: null,
      })
    useCartStore.getState().setQuantity('p1', 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})

describe('useCartStore.removeItem / setNotes', () => {
  it('removes a specific line', () => {
    const { addItem, removeItem } = useCartStore.getState()
    addItem({ productId: 'p1', name: 'A', unitPrice: '1.00', imageUrl: null })
    addItem({ productId: 'p2', name: 'B', unitPrice: '1.00', imageUrl: null })
    removeItem('p1')
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].productId).toBe('p2')
  })

  it('sets notes on the matching line only', () => {
    const { addItem, setNotes } = useCartStore.getState()
    addItem({ productId: 'p1', name: 'A', unitPrice: '1.00', imageUrl: null })
    addItem({ productId: 'p2', name: 'B', unitPrice: '1.00', imageUrl: null })
    setNotes('p1', 'no onions')
    const items = useCartStore.getState().items
    expect(items.find((i) => i.productId === 'p1')?.notes).toBe('no onions')
    expect(items.find((i) => i.productId === 'p2')?.notes).toBeNull()
  })
})

describe('useCartStore.setBusinessUnit', () => {
  it('sets the unit on a fresh cart without clearing items', () => {
    const { addItem, setBusinessUnit } = useCartStore.getState()
    setBusinessUnit('bu-1', 'Downtown')
    addItem({ productId: 'p1', name: 'A', unitPrice: '1.00', imageUrl: null })
    setBusinessUnit('bu-1', 'Downtown') // same unit — keep items
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().businessUnitName).toBe('Downtown')
  })

  it('clears the cart when switching to a different unit', () => {
    const { addItem, setBusinessUnit } = useCartStore.getState()
    setBusinessUnit('bu-1', 'Downtown')
    addItem({ productId: 'p1', name: 'A', unitPrice: '1.00', imageUrl: null })
    setBusinessUnit('bu-2', 'Airport')
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().businessUnitId).toBe('bu-2')
  })
})

describe('useCartStore.clear', () => {
  it('empties items and resets the business unit', () => {
    const { addItem, setBusinessUnit, clear } = useCartStore.getState()
    setBusinessUnit('bu-1', 'Downtown')
    addItem({ productId: 'p1', name: 'A', unitPrice: '1.00', imageUrl: null })
    clear()
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(0)
    expect(s.businessUnitId).toBeNull()
    expect(s.businessUnitName).toBeNull()
  })
})
