// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { Paginated, User } from '@/lib/api/types'
import { CustomerList } from './CustomerList'

function customer(id: string, name: string): User {
  return {
    id,
    username: name.toLowerCase().replace(' ', '.'),
    name,
    email: `${id}@example.com`,
    phone: null,
    role: 'CUSTOMER',
    businessUnitIds: [],
    isActive: true,
  }
}

function pageOf(users: User[], nextCursor: string | null): Paginated<User> {
  return {
    data: users,
    meta: { limit: 20, nextCursor, hasMore: nextCursor !== null },
  }
}

function renderList(initialPage: Paginated<User>) {
  return renderWithIntl(
    <CustomerList initialPage={initialPage} query={{ search: 'a' }} />,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CustomerList', () => {
  it('renders a neutral empty state, not a "widen your filters" hint', () => {
    renderList(pageOf([], null))
    // A MANAGER cannot widen past their unit claim, so suggesting it would be
    // a dead end (docs §1.3).
    expect(screen.getByText('No customers to show.')).toBeInTheDocument()
    expect(screen.queryByText(/widen/i)).not.toBeInTheDocument()
  })

  it('hides Load more once the cursor is exhausted', () => {
    renderList(pageOf([customer('c1', 'Carla Oliveira')], null))
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
  })

  it('appends the next cursor page and repeats the active filters', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => pageOf([customer('c2', 'Tiago Ramos')], null),
    } as Response)

    renderList(pageOf([customer('c1', 'Carla Oliveira')], 'c1'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() =>
      expect(screen.getAllByText('Tiago Ramos').length).toBeGreaterThan(0),
    )
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('/api/admin/customers')
    expect(url).toContain('cursor=c1')
    expect(url).toContain('search=a')
    // The first page must still be on screen — this appends, never replaces.
    expect(screen.getAllByText('Carla Oliveira').length).toBeGreaterThan(0)
    // Cursor exhausted by the second page.
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
  })

  it('stops offering a cursor the server rejected with a 4xx', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response)

    renderList(pageOf([customer('c1', 'Carla Oliveira')], 'c1'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load more results.',
      ),
    )
    // Retrying a cursor the server has already refused would just fail again.
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
  })

  // NOTE: the stale-response race guarded by the `generation` ref in
  // useCursorPages.ts is deliberately NOT covered here. Attempts to drive it
  // in jsdom passed identically with the guard removed — React discards the
  // late state update in the test environment in a way it does not in a real
  // browser — so the test asserted nothing. A test that cannot fail is worse
  // than none, so it was removed rather than left as false confidence.

  it('keeps Load more alive after a transient 5xx so the user can retry', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    renderList(pageOf([customer('c1', 'Carla Oliveira')], 'c1'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // A blip must not force a full page reload to recover.
    expect(
      screen.getByRole('button', { name: 'Load more' }),
    ).toBeInTheDocument()
  })
})
