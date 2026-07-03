// Mock fallback for the `/payments` endpoints.
import { mockDelay } from './_delay'
import type {
  CreatePaymentRequest,
  Payment,
  PaymentStatus,
} from '@/lib/api/types'

const STORE = new Map<string, Payment>()

function fakeTxId(): string {
  return `tx_${Math.random().toString(36).slice(2, 14)}`
}

function fakePixCode(): string {
  // Pseudo-PIX string just to show in the UI; not a real BR Code.
  return [
    '00020126',
    '0014BR.GOV.BCB.PIX',
    '0114+5581999999999',
    '5204000053039865802BR',
    '5905NEXIO',
    '6009RECIFE',
    `62${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    '6304ABCD',
  ].join('')
}

export async function createPaymentMock(
  body: CreatePaymentRequest,
  amount: string,
): Promise<Payment> {
  await mockDelay()

  const now = new Date().toISOString()
  const payment: Payment = {
    id: `pay_${Math.random().toString(36).slice(2, 12)}`,
    orderId: body.orderId,
    amount,
    method: body.method,
    status: body.method === 'PIX' ? 'PENDING' : 'PROCESSING',
    extTransactionId: fakeTxId(),
    pixCode: body.method === 'PIX' ? fakePixCode() : null,
    createdAt: now,
    updatedAt: now,
  }
  STORE.set(body.orderId, payment)
  return { ...payment }
}

export async function getPaymentMock(orderId: string): Promise<Payment | null> {
  await mockDelay()
  const p = STORE.get(orderId)
  if (!p) return null
  // Simulate status evolution: roughly 15-30s after creation it becomes APPROVED.
  const elapsed = Date.now() - new Date(p.createdAt).getTime()
  let next: PaymentStatus = p.status
  if (p.method === 'PIX') {
    if (elapsed > 30_000) next = 'APPROVED'
    else if (elapsed > 8_000) next = 'PROCESSING'
  } else if (elapsed > 6_000) {
    next = 'APPROVED'
  }
  if (next !== p.status) {
    p.status = next
    p.updatedAt = new Date().toISOString()
    STORE.set(orderId, p)
  }
  return { ...p }
}
