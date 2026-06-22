// TODO: backend not implemented yet — using mock data
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
    customerId,
    totalPoints: 100,
    consentGiven: false,
    consentDate: null,
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
  STORE.set(customerId, acc)
  return { ...acc, transactions: [...acc.transactions] }
}
