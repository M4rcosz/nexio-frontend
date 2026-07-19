import type { Role } from '@/lib/api/types'

export type DevSeedAccount = {
  username: string
  name: string
  role: Role
}

/**
 * Canonical list of throwaway dev accounts, shared by the account-switcher
 * UI (`DevAccountSwitcher`) and the mock login's role derivation
 * (`lib/api/mocks/auth-mock.ts`). Keeping both reading from this one list is
 * what stops them drifting apart — they used to be two hand-maintained
 * copies, and when the switcher's usernames changed to mirror the real
 * backend's seed data, the mock's copy was never updated: every non-customer
 * account silently logged in as CUSTOMER (no admin link, "My orders" showing
 * for staff). Mirrors the seed users in the backend's prisma/seed.ts.
 */
export const DEV_SEED_ACCOUNTS: DevSeedAccount[] = [
  { username: 'nexio.admin', name: 'Nexio Administrator', role: 'ADMIN' },
  { username: 'gustavo.linhares', name: 'Gustavo Linhares', role: 'MANAGER' },
  { username: 'nexio.attendant', name: 'Nexio Attendant', role: 'ATTENDANT' },
  { username: 'pedro.panic', name: 'Pedro Panic', role: 'KITCHEN' },
  { username: 'nexio.customer', name: 'Nexio Customer', role: 'CUSTOMER' },
]
