import { describe, it, expect } from 'vitest'
import { DEV_SEED_ACCOUNTS } from '@/lib/dev/seedAccounts'
import { mockLogin } from './auth-mock'

/** Decodes the `role` claim from a mock-issued access token without pulling
 * in the edge-safe decoder from lib/auth/session.ts — keeps this test from
 * depending on a second module to check the first. */
function decodeRole(token: string): string | null {
  const part = token.split('.')[1]
  if (!part) return null
  const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  return payload.role ?? null
}

describe('mockLogin — DevAccountSwitcher contract', () => {
  // Regression test: DevAccountSwitcher's usernames and this mock's role
  // derivation used to be two hand-maintained lists. When the switcher's
  // usernames were updated to mirror the real backend's seed data, the mock
  // wasn't — every non-customer account silently logged in as CUSTOMER
  // (admin/ERP nav link missing, "My orders" showing for staff). Both now
  // read from the same lib/dev/seedAccounts.ts list; this test exercises the
  // actual login path end-to-end so a future drift fails loudly here instead
  // of only being visible by clicking through the UI.
  it.each(DEV_SEED_ACCOUNTS)(
    'logs in $username with the $role role shown on its chip',
    async ({ username, role }) => {
      const { access_token } = await mockLogin({
        username,
        password: 'devpass1',
      })
      expect(decodeRole(access_token)).toBe(role)
    },
  )
})
