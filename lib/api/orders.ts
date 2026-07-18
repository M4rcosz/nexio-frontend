import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  CreateOrderRequest,
  ListMyOrdersQuery,
  ListOrdersQuery,
  Order,
  OrderStatus,
  Paginated,
} from './types'
import {
  cancelOrderMock,
  createOrderMock,
  getOrderMock,
  listMyOrdersMock,
  listOrdersMock,
  updateOrderStatusMock,
} from './mocks/orders'
import { MOCK_CUSTOMER } from './mocks/users'
import { getSession } from '@/lib/auth/session'

/**
 * `POST /orders`. Pass an `Idempotency-Key` so retries of the same payload
 * return the same order instead of duplicating it.
 */
export async function createOrder(
  body: CreateOrderRequest,
  opts: { idempotencyKey?: string } = {},
): Promise<Order> {
  if (USE_MOCKS) {
    const session = await getSession()
    return createOrderMock(session?.sub ?? MOCK_CUSTOMER.id, body)
  }
  return serverFetch<Order>('/orders', {
    method: 'POST',
    body,
    headers: opts.idempotencyKey
      ? { 'idempotency-key': opts.idempotencyKey }
      : undefined,
  })
}

/**
 * `GET /orders/:id`. Customers only see their own orders — the backend
 * answers 404 for anything not visible to the caller.
 */
export async function getOrder(id: string): Promise<Order | null> {
  if (USE_MOCKS) {
    return getOrderMock(id)
  }
  try {
    return await serverFetch<Order>(`/orders/${id}`, { cache: 'no-store' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `GET /orders/me` (CUSTOMER) — the caller's own orders, cursor-paginated and
 * ordered `createdAt` desc server-side. Staff callers get 403 from the backend.
 */
export async function listMyOrders(
  query: ListMyOrdersQuery = {},
): Promise<Paginated<Order>> {
  if (USE_MOCKS) {
    const session = await getSession()
    return listMyOrdersMock(session?.sub ?? MOCK_CUSTOMER.id, query)
  }
  return serverFetch<Paginated<Order>>('/orders/me', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      orderChannel: query.orderChannel,
      orderStatus: query.orderStatus,
    },
    cache: 'no-store',
  })
}

/**
 * `GET /orders` (staff: ADMIN/MANAGER/ATTENDANT/KITCHEN). Cursor-paginated,
 * filterable and sortable; results are limited to the actor's unit scope
 * server-side. The cursor is opaque and bound to `sortBy`/`sortDir` — never
 * reuse one after changing either (the backend answers 422).
 */
export async function listOrders(
  query: ListOrdersQuery = {},
): Promise<Paginated<Order>> {
  if (USE_MOCKS) {
    return listOrdersMock(query)
  }
  return serverFetch<Paginated<Order>>('/orders', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      businessUnitId: query.businessUnitId,
      orderChannel: query.orderChannel,
      orderStatus: query.orderStatus,
      attendantId: query.attendantId,
      customerId: query.customerId,
      createdAtFrom: query.createdAtFrom,
      createdAtTo: query.createdAtTo,
      minTotal: query.minTotal,
      maxTotal: query.maxTotal,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
    cache: 'no-store',
  })
}

/**
 * `PATCH /orders/:id/status` (staff). Invalid transitions answer 422 — the
 * valid machine is PENDING→CONFIRMED→PREPARING→READY→DELIVERED. `CANCELLED`
 * is technically a listed transition but this endpoint rejects it with 422;
 * use `cancelOrder` instead, which also runs the compensation saga.
 */
export async function updateOrderStatus(
  id: string,
  orderStatus: OrderStatus,
): Promise<Order | null> {
  if (USE_MOCKS) {
    return updateOrderStatusMock(id, orderStatus)
  }
  try {
    return await serverFetch<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: { orderStatus },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /orders/:id/cancel` — cancels and runs compensations (restock,
 * refund, points reversal). Customers only while PENDING; staff while
 * PENDING/CONFIRMED. Out-of-window answers 422.
 */
export async function cancelOrder(id: string): Promise<Order | null> {
  if (USE_MOCKS) {
    const session = await getSession()
    return cancelOrderMock(id, {
      role: session?.role ?? 'CUSTOMER',
      userId: session?.sub ?? MOCK_CUSTOMER.id,
    })
  }
  try {
    return await serverFetch<Order>(`/orders/${id}/cancel`, { method: 'POST' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
