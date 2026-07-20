// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { SessionPayload } from '@/lib/auth/session'
import messages from '@/messages/en.json'

// The localized <Link>/<router> need app-router context we don't have in a
// unit test — swap in plain equivalents, same as CartBadge.test.tsx.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))

// Header reads the current pathname from a middleware-set request header to
// suppress its nav on the kiosk; outside a request scope there is none, so an
// empty header set keeps these (non-kiosk) assertions unaffected.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

vi.mock('@/lib/tenant/resolve', () => ({
  getTenant: async () => ({
    id: 'nexio',
    name: 'Nexio',
    shortName: 'Nexio',
    logoMark: 'N',
    logoUrl: null,
    tagline: {},
    description: {},
    theme: { brand: {}, accent: {} },
  }),
}))

vi.mock('@/lib/api/ai', () => ({
  getMyAiMembership: vi.fn().mockResolvedValue(null),
}))

// Real Server Component translations, resolved server-side, are plain
// strings by the time Header returns JSX — so a tiny lookup against the same
// message catalog the client-side tests use keeps assertions meaningful.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (
      messages as unknown as Record<string, Record<string, string>>
    )[namespace]
    return (key: string, vars?: Record<string, unknown>) => {
      let str = dict?.[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    }
  },
}))

import { getSession } from '@/lib/auth/session'
import { Header } from './Header'

afterEach(cleanup)

async function renderHeader(session: SessionPayload | null) {
  vi.mocked(getSession).mockResolvedValue(session)
  const ui = await Header({ initialTheme: 'light' })
  return renderWithIntl(ui)
}

function session(role: string, username = 'test.user'): SessionPayload {
  return { sub: 'u1', username, role }
}

// Regression coverage for the bug where staff roles lost the admin/ERP nav
// link and got "My orders" back — a link-visibility matrix per role so a
// future edit to Header's isCustomer/showAdminLink gating fails a test
// instead of only being noticed by clicking through the UI.
describe('Header — nav link visibility by role', () => {
  it('shows sign in/up and no staff or customer nav when logged out', async () => {
    await renderHeader(null)
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ERP' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'My orders' }),
    ).not.toBeInTheDocument()
  })

  it('shows "My orders" and no ERP link for a CUSTOMER', async () => {
    await renderHeader(session('CUSTOMER'))
    expect(screen.getByRole('link', { name: 'My orders' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ERP' })).not.toBeInTheDocument()
  })

  it.each(['ADMIN', 'MANAGER'])(
    'shows the ERP link and no "My orders" for %s',
    async (role) => {
      await renderHeader(session(role))
      expect(screen.getByRole('link', { name: 'ERP' })).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'My orders' }),
      ).not.toBeInTheDocument()
    },
  )

  it.each(['ATTENDANT', 'KITCHEN'])(
    'shows neither the ERP link nor "My orders" for %s',
    async (role) => {
      await renderHeader(session(role))
      expect(
        screen.queryByRole('link', { name: 'ERP' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'My orders' }),
      ).not.toBeInTheDocument()
    },
  )

  it('renders the account avatar for every logged-in role', async () => {
    await renderHeader(session('MANAGER', 'gustavo.linhares'))
    expect(
      screen.getByRole('button', { name: 'Hi, gustavo.linhares' }),
    ).toBeInTheDocument()
  })
})
