// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Order, OrderStatus, Paginated } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/api/client', () => ({ clientFetch: vi.fn() }))

import { clientFetch } from '@/lib/api/client'
import { MyOrdersList } from './MyOrdersList'

const mockedClientFetch = vi.mocked(clientFetch)

function makeOrder(id: string, status: OrderStatus = 'PENDING'): Order {
  return {
    id,
    businessUnitId: 'bu-1',
    customerId: 'c1',
    customerName: null,
    attendantId: null,
    pointsRedeemed: 0,
    pointsEarned: 0,
    totalAmount: '51.80',
    notes: null,
    orderChannel: 'WEB',
    orderStatus: status,
    createdAt: '2026-07-01T12:00:00Z',
    updatedAt: '',
    updatedById: null,
    orderItems: [],
  }
}

function page(
  data: Order[],
  nextCursor: string | null = null,
): Paginated<Order> {
  return {
    data,
    meta: { limit: 20, nextCursor, hasMore: nextCursor !== null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('MyOrdersList', () => {
  it('renders the server-rendered first page', () => {
    renderWithIntl(
      <MyOrdersList
        initial={page([makeOrder('o1'), makeOrder('o2', 'DELIVERED')])}
      />,
    )
    expect(screen.getByText('o1')).toBeInTheDocument()
    expect(screen.getByText('o2')).toBeInTheDocument()
    // Open orders show the live status chip; terminal ones a plain chip.
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument()
    expect(screen.getByText(/delivered/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no orders', () => {
    renderWithIntl(<MyOrdersList initial={page([])} />)
    expect(
      screen.getByText(/no orders match these filters/i),
    ).toBeInTheDocument()
  })

  it('refetches with the selected status filter', async () => {
    const user = userEvent.setup()
    mockedClientFetch.mockResolvedValue(page([makeOrder('o9', 'READY')]))
    renderWithIntl(<MyOrdersList initial={page([makeOrder('o1')])} />)

    // Open the status Select and pick "Ready for delivery".
    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(
      screen.getByRole('option', { name: /ready for delivery/i }),
    )

    await waitFor(() => expect(mockedClientFetch).toHaveBeenCalled())
    const call = mockedClientFetch.mock.calls.at(-1)!
    expect(call[1]).toMatchObject({
      query: expect.objectContaining({ orderStatus: 'READY' }),
    })
    await waitFor(() => expect(screen.getByText('o9')).toBeInTheDocument())
    expect(screen.queryByText('o1')).not.toBeInTheDocument()
  })

  it('loads and appends the next page, de-duplicating ids', async () => {
    const user = userEvent.setup()
    // Second page repeats o2 (should be dropped) and adds o3.
    mockedClientFetch.mockResolvedValue(
      page([makeOrder('o2'), makeOrder('o3')]),
    )
    renderWithIntl(
      <MyOrdersList
        initial={page([makeOrder('o1'), makeOrder('o2')], 'cursor-2')}
      />,
    )

    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getByText('o3')).toBeInTheDocument())

    const list = screen.getByRole('list')
    expect(within(list).getAllByText(/^o2$/)).toHaveLength(1)
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  })
})
