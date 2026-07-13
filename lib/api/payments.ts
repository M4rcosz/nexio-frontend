import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type { CreatePaymentRequest, Payment } from './types'
import { createPaymentMock, getPaymentMock } from './mocks/payments'

/**
 * `POST /payments` — creates the payment for an order and triggers the
 * gateway. 422 when the order is not awaiting payment or is already paid.
 *
 * `mockAmount` feeds the mock store only (the real backend derives the amount
 * from the order).
 */
export async function createPayment(
  body: CreatePaymentRequest,
  mockAmount = '0.00',
): Promise<Payment> {
  if (USE_MOCKS) {
    return createPaymentMock(body, mockAmount)
  }
  return serverFetch<Payment>('/payments', {
    method: 'POST',
    body,
  })
}

/**
 * `GET /orders/:orderId/payment` — the payment of an order (customers only
 * see their own). `null` when there is no payment or it is not visible.
 */
export async function getOrderPayment(
  orderId: string,
): Promise<Payment | null> {
  if (USE_MOCKS) {
    return getPaymentMock(orderId)
  }
  try {
    return await serverFetch<Payment>(`/orders/${orderId}/payment`, {
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
