// [stub] backend does not implement /payments yet — always uses mock.
import type { CreatePaymentRequest, Payment } from './types'
import {
  createPaymentMock,
  getPaymentMock,
} from './mocks/payments'

export async function createPayment(
  orderId: string,
  amount: string,
  body: CreatePaymentRequest,
): Promise<Payment> {
  return createPaymentMock(orderId, amount, body)
}

export async function getPayment(orderId: string): Promise<Payment | null> {
  return getPaymentMock(orderId)
}
