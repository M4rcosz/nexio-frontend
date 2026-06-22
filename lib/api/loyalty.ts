// [stub] backend does not implement /loyalty yet — always uses mock.
import type { LoyaltyAccount } from './types'
import { getMyLoyaltyMock, giveConsentMock } from './mocks/loyalty'
import { MOCK_CUSTOMER } from './mocks/users'

export async function getMyLoyalty(): Promise<LoyaltyAccount> {
  return getMyLoyaltyMock(MOCK_CUSTOMER.id)
}

export async function giveLoyaltyConsent(): Promise<LoyaltyAccount> {
  return giveConsentMock(MOCK_CUSTOMER.id)
}
