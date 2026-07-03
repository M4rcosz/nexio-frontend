// Mock fallback for the `/loyalty` endpoints. The `transactions` list is a
// front-side extra — the real backend only returns the account.
import { mockDelay } from './_delay'
import type { LoyaltyAccount, LoyaltyTransaction } from '@/lib/api/types'

type Account = LoyaltyAccount & { transactions: LoyaltyTransaction[] }

const STORE = new Map<string, Account>()

function seed(customerId: string): Account {
  const now = new Date()
  const transactions: LoyaltyTransaction[] = [
    {
      id: 'lt_1',
      type: 'EARN',
      points: 58,
      description: 'Order #1042 — Carne de sol',
      createdAt: new Date(now.getTime() - 86_400_000 * 3).toISOString(),
    },
    {
      id: 'lt_2',
      type: 'EARN',
      points: 42,
      description: 'Order #1107 — Baião de dois',
      createdAt: new Date(now.getTime() - 86_400_000 * 1).toISOString(),
    },
  ]
  return {
    id: `loy_${customerId}`,
    customerId,
    totalPoints: 100,
    consentGiven: false,
    consentDate: null,
    consentRevokedAt: null,
    createdAt: new Date(now.getTime() - 86_400_000 * 7).toISOString(),
    transactions,
  }
}

export async function getMyLoyaltyMock(
  customerId: string,
): Promise<LoyaltyAccount> {
  await mockDelay()
  let acc = STORE.get(customerId)
  if (!acc) {
    acc = seed(customerId)
    STORE.set(customerId, acc)
  }
  return { ...acc, transactions: [...acc.transactions] }
}

export async function giveConsentMock(
  customerId: string,
): Promise<LoyaltyAccount> {
  await mockDelay()
  let acc = STORE.get(customerId)
  if (!acc) {
    acc = seed(customerId)
  }
  acc.consentGiven = true
  acc.consentDate = new Date().toISOString()
  acc.consentRevokedAt = null
  STORE.set(customerId, acc)
  return { ...acc, transactions: [...acc.transactions] }
}

export async function revokeConsentMock(
  customerId: string,
): Promise<LoyaltyAccount | null> {
  await mockDelay()
  const acc = STORE.get(customerId)
  if (!acc) return null
  acc.consentGiven = false
  acc.consentRevokedAt = new Date().toISOString()
  STORE.set(customerId, acc)
  return { ...acc, transactions: [...acc.transactions] }
}
