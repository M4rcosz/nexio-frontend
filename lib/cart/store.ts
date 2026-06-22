'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Big from 'big.js'
import { asMoney, multiplyMoney } from '@/lib/money'

export type CartItem = {
  productId: string
  name: string
  unitPrice: string
  imageUrl: string | null
  quantity: number
  notes: string | null
}

type CartState = {
  businessUnitId: string | null
  businessUnitName: string | null
  items: CartItem[]
  setBusinessUnit: (id: string, name: string) => void
  addItem: (item: Omit<CartItem, 'quantity' | 'notes'> & { quantity?: number; notes?: string | null }) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  setNotes: (productId: string, notes: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      businessUnitId: null,
      businessUnitName: null,
      items: [],

      setBusinessUnit: (id, name) =>
        set((s) => {
          if (s.businessUnitId && s.businessUnitId !== id) {
            return {
              businessUnitId: id,
              businessUnitName: name,
              items: [],
            }
          }
          return { businessUnitId: id, businessUnitName: name }
        }),

      addItem: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                  : i,
              ),
            }
          }
          return {
            items: [
              ...s.items,
              {
                productId: item.productId,
                name: item.name,
                unitPrice: item.unitPrice,
                imageUrl: item.imageUrl,
                quantity: item.quantity ?? 1,
                notes: item.notes ?? null,
              },
            ],
          }
        }),

      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

      setQuantity: (productId, quantity) =>
        set((s) => ({
          items:
            quantity <= 0
              ? s.items.filter((i) => i.productId !== productId)
              : s.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i,
                ),
        })),

      setNotes: (productId, notes) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId ? { ...i, notes } : i,
          ),
        })),

      clear: () => set({ items: [], businessUnitId: null, businessUnitName: null }),
    }),
    {
      name: 'raizes-cart',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export function cartTotal(items: CartItem[]): Big {
  return items.reduce<Big>(
    (acc, item) => acc.plus(multiplyMoney(item.unitPrice, item.quantity)),
    asMoney(0),
  )
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.quantity, 0)
}
