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
import { findUserBySubMock } from './admin-users'
import {
  asMoney,
  LOYALTY_POINT_VALUE,
  multiplyMoney,
  sumMoney,
} from '@/lib/money'
import { bestPromotion, isPromotionLive } from '@/lib/promotions'
import { VALID_TRANSITIONS } from '@/lib/orders/statusMachine'
import { getChannelPolicy } from '@/lib/orders/channelPolicy'
import { mockDelay } from './_delay'
import { ApiError } from '@/lib/api/errors'

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

/**
 * Resolve the display `customerName` at read time (doc §5): for an account
 * order (has `customerId`) it is the customer's *current* name, looked up live
 * from the user record — so a rename is reflected in past orders. For a guest
 * order it is the typed walk-in name stored on the order. Never cached as
 * immutable, so the mock re-resolves on every read.
 */
function withResolvedName(order: Order): Order {
  if (order.customerId) {
    const user = findUserBySubMock(order.customerId)
    return { ...order, customerName: user?.name ?? order.customerName ?? null }
  }
  return { ...order }
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
  actorId: string | null,
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
  // `bestPromotion` only guards the end of the window — the store also holds
  // drafts and not-yet-started rows, so liveness is filtered here first.
  const applied = bestPromotion(
    promotionsForUnitMockSync(body.businessUnitId).filter((p) =>
      isPromotionLive(p),
    ),
    itemsSubtotal,
  )
  const total = itemsSubtotal
    .minus(applied?.discount ?? asMoney(0))
    .minus(asMoney(pointsRedeemed).times(LOYALTY_POINT_VALUE))
  const clampedTotal = total.lt(0) ? asMoney(0) : total
  const now = new Date().toISOString()

  // Channel decides who the actor is (doc §3). Only APP/WEB take the JWT
  // subject as the customer; COUNTER/PICKUP put the subject on `attendantId`
  // and the customer (if any) comes from the body; TOTEM has neither.
  const policy = getChannelPolicy(body.orderChannel)
  let customerId: string | null
  let attendantId: string | null = null
  if (policy.requiresStaffActor) {
    attendantId = actorId
    customerId = body.customerId ?? null
  } else if (body.orderChannel === 'TOTEM') {
    customerId = null
  } else {
    customerId = actorId
  }

  const order: Order = {
    id: newId(),
    businessUnitId: body.businessUnitId,
    customerId,
    // Guest walk-in name is stored; account orders resolve it live on read.
    customerName: body.customerName ?? null,
    attendantId,
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
  return withResolvedName(order)
}

export async function getOrderMock(id: string): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null
  tickStatus(found)
  return withResolvedName(found)
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
    // `/orders/me` migrated to keyset too: its cursor is now an opaque token,
    // not a row id, and a stale one is 422 rather than a silently short page.
    // The old empty-page behaviour is what made the bug invisible.
    const decoded = decodeOrdersCursor(query.cursor)
    const idx = decoded ? rows.findIndex((o) => o.id === decoded.id) : -1
    if (idx < 0) {
      throw new ApiError(422, null, 'Invalid pagination cursor.')
    }
    rows = rows.slice(idx + 1)
  }
  const limit =
    query.limit && query.limit > 0 ? Math.min(Math.trunc(query.limit), 100) : 20
  const page = rows.slice(0, limit).map(withResolvedName)
  const hasMore = rows.length > limit
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeOrdersCursor({
          sortBy: 'createdAt',
          sortDir: 'desc',
          id: last.id,
        })
      : null
  return { data: page, meta: { limit, nextCursor, hasMore } }
}

type OrderCursor = {
  sortBy: NonNullable<ListOrdersQuery['sortBy']>
  sortDir: NonNullable<ListOrdersQuery['sortDir']>
  id: string
}

/**
 * The staff cursor is opaque and bound to the sort it was minted under
 * (mirrors the backend). Encoding it (instead of a bare id, like `/orders/me`
 * uses) is what lets us detect a sort change and answer 422 rather than
 * silently restarting the sort.
 */
function encodeOrdersCursor(cursor: OrderCursor): string {
  // base64url, no `=` padding — the charset the real tokens use, so a cursor
  // that survives the mock also survives being put on a query string live.
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url')
}

function decodeOrdersCursor(raw: string): OrderCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'))
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.id === 'string' &&
      typeof parsed.sortBy === 'string' &&
      typeof parsed.sortDir === 'string'
    ) {
      return parsed as OrderCursor
    }
    return null
  } catch {
    return null
  }
}

export async function listOrdersMock(
  query: ListOrdersQuery = {},
): Promise<Paginated<Order>> {
  await mockDelay()
  const sortBy = query.sortBy ?? 'createdAt'
  const sortDir = query.sortDir ?? 'desc'

  let data = STORE.map((o) => {
    tickStatus(o)
    return withResolvedName(o)
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
  if (query.attendantId) {
    data = data.filter((o) => o.attendantId === query.attendantId)
  }
  if (query.customerId) {
    data = data.filter((o) => o.customerId === query.customerId)
  }
  if (query.createdAtFrom) {
    data = data.filter((o) => o.createdAt >= query.createdAtFrom!)
  }
  if (query.createdAtTo) {
    data = data.filter((o) => o.createdAt <= query.createdAtTo!)
  }
  if (query.minTotal) {
    const min = asMoney(query.minTotal)
    data = data.filter((o) => asMoney(o.totalAmount).gte(min))
  }
  if (query.maxTotal) {
    const max = asMoney(query.maxTotal)
    data = data.filter((o) => asMoney(o.totalAmount).lte(max))
  }

  data.sort((a, b) => {
    const cmp =
      sortBy === 'totalAmount'
        ? asMoney(a.totalAmount).cmp(asMoney(b.totalAmount))
        : a.createdAt.localeCompare(b.createdAt)
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (query.cursor) {
    const decoded = decodeOrdersCursor(query.cursor)
    // Sort-mismatched or malformed cursor → the real endpoint's 422, not a
    // silent restart (it would look like the new sort worked when it hadn't).
    if (!decoded || decoded.sortBy !== sortBy || decoded.sortDir !== sortDir) {
      throw Object.assign(new Error('Invalid or sort-mismatched cursor.'), {
        code: 'invalid_cursor',
      })
    }
    const idx = data.findIndex((o) => o.id === decoded.id)
    data = idx >= 0 ? data.slice(idx + 1) : []
  }

  const limit =
    query.limit && query.limit > 0 ? Math.min(Math.trunc(query.limit), 100) : 20
  const page = data.slice(0, limit)
  const hasMore = data.length > limit
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeOrdersCursor({ sortBy, sortDir, id: last.id })
      : null
  return { data: page, meta: { limit, nextCursor, hasMore } }
}

export async function updateOrderStatusMock(
  id: string,
  orderStatus: OrderStatus,
): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null
  // CANCELLED is a listed transition, but this endpoint always rejects it —
  // cancelling must go through `cancelOrderMock` (it runs compensations).
  if (
    orderStatus === 'CANCELLED' ||
    !VALID_TRANSITIONS[found.orderStatus].includes(orderStatus)
  ) {
    throw Object.assign(
      new Error(`Invalid transition ${found.orderStatus} → ${orderStatus}.`),
      { code: 'invalid_transition' },
    )
  }
  found.orderStatus = orderStatus
  found.updatedAt = new Date().toISOString()
  return withResolvedName(found)
}

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN']

export async function cancelOrderMock(
  id: string,
  actor: { role: string; userId: string },
): Promise<Order | null> {
  await mockDelay()
  const found = STORE.find((o) => o.id === id)
  if (!found) return null

  // Staff may cancel while PENDING or CONFIRMED; a customer only their own
  // order, and only while PENDING (mirrors the backend's cancellation window).
  const windowOpen = STAFF_ROLES.includes(actor.role)
    ? found.orderStatus === 'PENDING' || found.orderStatus === 'CONFIRMED'
    : found.customerId === actor.userId && found.orderStatus === 'PENDING'
  if (!windowOpen) {
    throw Object.assign(new Error('Past the cancellation window.'), {
      code: 'cancel_window_closed',
    })
  }

  found.orderStatus = 'CANCELLED'
  found.updatedAt = new Date().toISOString()
  return withResolvedName(found)
}
