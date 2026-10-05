// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'

let pathname = '/admin'
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { AdminSidebar } from '@/components/admin/AdminSidebar'

afterEach(() => {
  cleanup()
  pathname = '/admin'
})

/** The desktop rail; the mobile drawer renders the same list from a portal. */
function rail() {
  return screen.getByRole('navigation', { name: /admin/i })
}

describe('AdminSidebar — grouping', () => {
  it('renders every group heading for an ADMIN', () => {
    renderWithIntl(<AdminSidebar role="ADMIN" />)
    for (const heading of ['Operations', 'Catalog', 'Management']) {
      expect(within(rail()).getByText(heading)).toBeInTheDocument()
    }
  })

  it('keeps entries under the group they belong to', () => {
    renderWithIntl(<AdminSidebar role="ADMIN" />)
    const links = within(rail())
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    // Operations first, Management last — the order encodes the grouping.
    expect(links).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/menu',
      '/admin/inventory',
      '/admin/workflows',
      '/admin/products',
      '/admin/categories',
      '/admin/promotions',
      '/admin/users',
      '/admin/customers',
      '/admin/business-units',
      '/admin/ai',
    ])
  })
})

describe('AdminSidebar — role filtering', () => {
  it('hides admin-only entries from a MANAGER', () => {
    renderWithIntl(<AdminSidebar role="MANAGER" />)
    const links = within(rail())
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    expect(links).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/menu',
      '/admin/inventory',
      '/admin/products',
      '/admin/promotions',
      '/admin/users',
    ])
  })

  // Spelled out on its own: a workflow fires HTTP calls at third parties with
  // stored credentials, so the entry must never appear for a MANAGER even if
  // the array above is rearranged.
  it('never offers workflows to a MANAGER', () => {
    renderWithIntl(<AdminSidebar role="MANAGER" />)
    expect(
      within(rail()).queryByRole('link', { name: /workflows/i }),
    ).not.toBeInTheDocument()
  })

  // A group emptied by the role filter must take its heading with it, or the
  // rail shows a label with nothing under it.
  it('drops a group heading when the role empties the group', () => {
    renderWithIntl(<AdminSidebar role="MANAGER" />)
    // Management still has Users, so it stays; nothing is emptied today —
    // pin the invariant so a future adminOnly entry can't leave a stray label.
    const headings = ['Operations', 'Catalog', 'Management']
    for (const heading of headings) {
      const label = within(rail()).queryByText(heading)
      if (!label) continue
      const group = label.parentElement!
      expect(within(group).getAllByRole('link').length).toBeGreaterThan(0)
    }
  })
})

describe('AdminSidebar — active state', () => {
  it('marks the current route with aria-current', () => {
    pathname = '/admin/users'
    renderWithIntl(<AdminSidebar role="ADMIN" />)
    const current = within(rail()).getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('href', '/admin/users')
  })

  it('marks the parent entry on a nested route', () => {
    pathname = '/admin/products/abc/edit'
    renderWithIntl(<AdminSidebar role="ADMIN" />)
    const current = within(rail()).getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('href', '/admin/products')
  })

  // `/admin` is a prefix of every other entry, so it needs the exact match.
  it('does not mark Overview active on a sub-route', () => {
    pathname = '/admin/orders'
    renderWithIntl(<AdminSidebar role="ADMIN" />)
    const current = within(rail()).getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('href', '/admin/orders')
  })
})
