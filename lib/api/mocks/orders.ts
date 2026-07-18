// Mock fallback for the `/orders` endpoints.
import type {
  CreateOrderRequest,
  ListMyOrdersQuery,
  ListOrdersQuery,
  Order,
  OrderItem,
  OrderStatus,
  Paginated,
} from '@/lib/api/types'
import { MOCK_PRODUCTS } from './products'
import { promotionsForUnitMockSync } from './promotions'
import {
  asMoney,
  LOYALTY_POINT_VALUE,
  multiplyMoney,
  sumMoney,
} from '@/lib/money'
import { bestPromotion } from '@/lib/promotions'
import { mockDelay } from './_delay'

const STORE: Order[] = []

const ORDER_TIMELINE: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
]

// Mirrors the backend state machine (transitions outside this map → 422).
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

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
  customerId: string | null,
  body: CreateOrderRequest,
): Promise<Order> {
  await mockDelay()

  const orderItems: OrderItem[] = body.orderItems.map((it, idx) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === it.productId)
    const unitPrice = asMoney(it.unitPrice)
    const subtotal = multiplyMoney(unitPrice, it.quantity)
    return {
      id: `oi_${Date.now().toString(36)}_${idx}`,
      productId: it.productId,
      productName: product?.name,
      quantity: it.quantity,
      unitPrice: unitPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
      notes: it.notes ?? null,
    }
  })

  const pointsRedeemed = body.pointsRedeemed ?? 0
  const itemsSubtotal = sumMoney(orderItems.map((i) => i.subtotal))
  // One promotion per order, applied before loyalty (backend contract).
  const applied = bestPromotion(
    promotionsForUnitMockSync(body.businessUnitId),
    itemsSubtotal,
  )
  const total = itemsSubtotal
    .minus(applied?.discount ?? asMoney(0))
    .minus(asMoney(pointsRedeemed).times(LOYALTY_POINT_VALUE))
  const clampedTotal = total.lt(0) ? asMoney(0) : total
  const now = new Date().toISOString()

  const order: Order = {
    id: newId(),
    businessUnitId: body.businessUnitId,
    customerId: body.customerId ?? customerId,
    attendantId: null,
    pointsRedeemed,
    // Earning: 1 point per R$10, granted on payment approval server-side.
    pointsEarned: Math.floor(Number(clampedTotal.toFixed(2)) / 10),
    totalAmount: clampedTotal.toFixed(2),
    notes: body.notes ?? null,
    orderChannel: body.orderChannel,
    orderStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
    updatedById: null,
    orderItems,
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
  query: ListMyOrdersQuery = {},
): Promise<Paginated<Order>> {
  await mockDelay()
  let rows = STORE.filter((o) => o.customerId === customerId)
  rows.forEach(tickStatus)
  if (query.orderChannel) {
    rows = rows.filter((o) => o.orderChannel === query.orderChannel)
  }
  if (query.orderStatus) {
    rows = rows.filter((o) => o.orderStatus === query.orderStatus)
  }
  // Match the real endpoint: createdAt desc, cursor-paginated.
  rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (query.cursor) {
    const idx = rows.findIndex((o) => o.id === query.cursor)
    // Unknown cursor → return an empty page rather than the whole list.
    rows = idx >= 0 ? rows.slice(idx + 1) : []
  }
  const limit =
    query.limit && query.limit > 0 ? Math.min(Math.trunc(query.limit), 100) : 20
  const page = rows.slice(0, limit).map((o) => ({ ...o }))
  const hasMore = rows.length > limit
  const nextCursor =
    hasMore && page.length > 0 ? page[page.length - 1].id : null
  return { data: page, meta: { limit, nextCursor, hasMore } }
}

export async function listOrdersMock(
  query: ListOrdersQuery = {},
): Promise<Paginated<Order>> {
  await mockDelay()
  let data = STORE.map((o) => {
    tickStatus(o)
    return { ...o }
  })
  if (query.businessUnitId) {
    data = data.filter((o) => o.businessUnitId === query.businessUnitId)
  }
  if (query.orderChannel) {
    data = data.filter((o) => o.orderChannel === query.orderChannel)
  }
  if (query.orderStatus) {
    data = data.filter((o) => o.orderStatus === query.orderStatus)
  }
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function updateOrderStatusMock(
  id: string,
  orderStatus: OrderStatus,
): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null
  if (!VALID_TRANSITIONS[found.orderStatus].includes(orderStatus)) {
    throw Object.assign(
      new Error(`Invalid transition ${found.orderStatus} → ${orderStatus}.`),
      { code: 'invalid_transition' },
    )
  }
  found.orderStatus = orderStatus
  found.updatedAt = new Date().toISOString()
  return { ...found }
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
