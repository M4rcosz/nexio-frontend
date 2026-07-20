import type { OrderStatus } from '@/lib/api/types'

/**
 * The order status state machine, mirroring the backend (doc §9). Any
 * transition not listed here answers 422 on `PATCH /orders/:id/status`, and a
 * status is never a valid target for itself (no-op updates are rejected too).
 *
 * This is the single source of truth: the mock imports it (rather than keeping
 * its own copy) and the staff board derives its action buttons from it, so the
 * frontend and backend machines cannot drift.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

/**
 * The PATCH-eligible next statuses for the given status — i.e. the forward
 * transitions with `CANCELLED` filtered out. The frontend never PATCHes to
 * CANCELLED: cancellation always goes through `POST /orders/:id/cancel`, which
 * runs the compensation saga (restock/refund/loyalty reversal, doc §10). This
 * is what drives the staff board's status buttons.
 */
export function forwardStatuses(current: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[current].filter((s) => s !== 'CANCELLED')
}

const STAFF_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED']
const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING']

/**
 * Whether the given actor may cancel an order in this status (doc §10):
 * staff (of the unit) while PENDING or CONFIRMED, a customer only while
 * PENDING. This gates the cancel control; the backend still enforces the same
 * window, so callers must handle a 422 in case the status changed between
 * render and click.
 */
export function canCancel(
  status: OrderStatus,
  actor: 'staff' | 'customer',
): boolean {
  return actor === 'staff'
    ? STAFF_CANCELLABLE.includes(status)
    : CUSTOMER_CANCELLABLE.includes(status)
}
