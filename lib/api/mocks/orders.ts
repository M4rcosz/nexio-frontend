// Mock fallback for the `/orders` endpoints.
import type {
  CreateOrderRequest,
  ListOrdersQuery,
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
  // Redeeming: 1pt = R$0.10 discount, mirroring the loyalty rule.
  const total = sumMoney(orderItems.map((i) => i.subtotal)).minus(
    asMoney(pointsRedeemed).times('0.10'),
  )
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
): Promise<Paginated<Order>> {
  await mockDelay()
  const data = STORE.filter((o) => o.customerId === customerId).map((o) => {
    tickStatus(o)
    return { ...o }
  })
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
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
