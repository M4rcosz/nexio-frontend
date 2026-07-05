// Mock fallback for `GET /users/me` (used when NEXT_PUBLIC_USE_MOCKS=true).
import { mockDelay } from './_delay'
import { findUserBySubMock } from './admin-users'
import type { UpdateMeRequest, User } from '@/lib/api/types'

/** Customer demo (used by guest order/loyalty flows that don't read JWT). */
export const MOCK_CUSTOMER: User = {
  id: 'usr_customer_demo',
  username: 'demo.customer',
  email: 'demo.customer@nexio.com',
  name: 'Demo Customer',
  phone: '(81) 99999-0000',
  role: 'CUSTOMER',
  businessUnitIds: [],
  isActive: true,
}

/** Per-subject overrides applied by `updateMeMock`. */
const ME_OVERRIDES = new Map<string, Partial<User>>()

/** Resolve the logged-in user from the JWT subject. */
export async function getMeMock(sub?: string | null): Promise<User> {
  await mockDelay()
  const base = (sub && findUserBySubMock(sub)) || MOCK_CUSTOMER
  const override = sub ? ME_OVERRIDES.get(sub) : undefined
  return { ...base, ...override }
}

/** Mirrors `PATCH /users/me` (name and/or phone). */
export async function updateMeMock(
  sub: string | null | undefined,
  patch: UpdateMeRequest,
): Promise<User> {
  await mockDelay()
  const key = sub ?? MOCK_CUSTOMER.id
  const current = ME_OVERRIDES.get(key) ?? {}
  const next: Partial<User> = { ...current }
  if (patch.name !== undefined) next.name = patch.name
  if (patch.phone !== undefined) next.phone = patch.phone
  ME_OVERRIDES.set(key, next)
  return getMeMock(key)
}
