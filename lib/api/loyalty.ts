import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type { LoyaltyAccount } from './types'
import {
  getMyLoyaltyMock,
  giveConsentMock,
  revokeConsentMock,
} from './mocks/loyalty'
import { MOCK_CUSTOMER } from './mocks/users'
import { getSession } from '@/lib/auth/session'

async function mockCustomerId(): Promise<string> {
  const session = await getSession()
  return session?.sub ?? MOCK_CUSTOMER.id
}

/**
 * `GET /loyalty/me` (CUSTOMER). `null` when the account does not exist yet —
 * it is created on the first order / consent.
 */
export async function getMyLoyalty(): Promise<LoyaltyAccount | null> {
  if (USE_MOCKS) {
    return getMyLoyaltyMock(await mockCustomerId())
  }
  try {
    return await serverFetch<LoyaltyAccount>('/loyalty/me', {
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /loyalty/me/consent` (CUSTOMER) — grants LGPD consent. Idempotent
 * upsert: creates the account when missing.
 */
export async function giveLoyaltyConsent(): Promise<LoyaltyAccount> {
  if (USE_MOCKS) {
    return giveConsentMock(await mockCustomerId())
  }
  return serverFetch<LoyaltyAccount>('/loyalty/me/consent', {
    method: 'POST',
  })
}

/**
 * `DELETE /loyalty/me/consent` (CUSTOMER) — revokes LGPD consent. `null` when
 * there is no account.
 */
export async function revokeLoyaltyConsent(): Promise<LoyaltyAccount | null> {
  if (USE_MOCKS) {
    return revokeConsentMock(await mockCustomerId())
  }
  try {
    return await serverFetch<LoyaltyAccount>('/loyalty/me/consent', {
      method: 'DELETE',
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
