// TODO: backend not implemented yet — using mock data
import type {
  CreateOrderRequest,
  Order,
  OrderItem,
  OrderStatus,
  Paginated,
} from '@/lib/api/types'
import { MOCK_PRODUCTS } from './products'
import { asMoney, multiplyMoney, sumMoney } from '@/lib/money'
import { mockDelay } from './_delay'

const STORE: Order[] = []

const ORDER_TIMELINE: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
]

function newId(prefix = 'ord'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

function tickStatus(order: Order): Order {
  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'DELIVERED') {
    return order
  }
  const elapsedMs = Date.now() - new Date(order.createdAt).getTime()
  // Every ~25s the order advances one step in the mock — purely so the
  // timeline animates while you look at the screen.
  const step = Math.min(
    ORDER_TIMELINE.length - 1,
    Math.floor(elapsedMs / 25_000),
  )
  const next = ORDER_TIMELINE[step]
  if (next !== order.orderStatus) {
    order.orderStatus = next
    order.updatedAt = new Date().toISOString()
  }
  return order
}

export async function createOrderMock(
  customerId: string,
  body: CreateOrderRequest,
): Promise<Order> {
  await mockDelay()

  const items: OrderItem[] = body.items.map((it) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === it.productId)
    const unitPrice = asMoney(product?.price ?? 0)
    const subtotal = multiplyMoney(unitPrice, it.quantity)
    return {
      productId: it.productId,
      productName: product?.name,
      quantity: it.quantity,
      unitPrice: unitPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
      notes: it.notes ?? null,
    }
  })

  const total = sumMoney(items.map((i) => i.subtotal))
  const now = new Date().toISOString()

  const order: Order = {
    id: newId(),
    businessUnitId: body.businessUnitId,
    customerId,
    attendantId: null,
    orderChannel: body.orderChannel,
    orderStatus: 'PENDING',
    totalAmount: total.toFixed(2),
    pointsEarned: Math.floor(Number(total.toFixed(2))),
    pointsRedeemed: 0,
    notes: body.notes ?? null,
    items,
    createdAt: now,
    updatedAt: now,
  }
  STORE.unshift(order)
  return { ...order }
}

export async function getOrderMock(id: string): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null
  tickStatus(found)
  return { ...found }
}

export async function listMyOrdersMock(
  customerId: string,
): Promise<Paginated<Order>> {
  await mockDelay()
  const data = STORE.filter((o) => o.customerId === customerId).map((o) => {
    tickStatus(o)
    return { ...o }
  })
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function cancelOrderMock(id: string): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null
  if (found.orderStatus === 'DELIVERED') return { ...found }
  found.orderStatus = 'CANCELLED'
  found.updatedAt = new Date().toISOString()
  return { ...found }
}
