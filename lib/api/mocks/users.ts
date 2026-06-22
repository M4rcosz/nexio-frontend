// TODO: backend not implemented yet — using mock data
import { mockDelay } from './_delay'
import { findUserBySubMock } from './admin-users'
import type { User } from '@/lib/api/types'

const NOW = new Date().toISOString()

/** Customer demo (used by guest order/loyalty flows that don't read JWT). */
export const MOCK_CUSTOMER: User = {
  id: 'usr_customer_demo',
  username: 'demo.customer',
  email: 'demo.customer@raizes.com',
  name: 'Demo Customer',
  phone: '(81) 99999-0000',
  role: 'CUSTOMER',
  businessUnitId: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

/** Resolve the logged-in user from the JWT subject. */
export async function getMeMock(sub?: string | null): Promise<User> {
  await mockDelay()
  if (sub) {
    const internal = findUserBySubMock(sub)
    if (internal) return { ...internal }
  }
  return { ...MOCK_CUSTOMER }
}
