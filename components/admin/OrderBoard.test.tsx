// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type {
  Order,
  OrderStatus,
  Paginated,
  PublicBusinessUnit,
} from '@/lib/api/types'

vi.mock('@/lib/api/client', () => ({ clientFetch: vi.fn() }))

import { clientFetch } from '@/lib/api/client'
import { OrderBoard } from './OrderBoard'

const mockedClientFetch = vi.mocked(clientFetch)

function makeOrder(id: string, status: OrderStatus = 'PENDING'): Order {
  return {
    id,
    businessUnitId: 'bu-1',
    customerId: 'c1',
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

const units: PublicBusinessUnit[] = [
  { id: 'bu-1', name: 'Downtown', address: '', city: '', phone: '' },
]

function mockRowFetch(status: number, body: unknown = {}) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
  const fn = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OrderBoard', () => {
  it('renders the server-rendered first page', () => {
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1'), makeOrder('o2', 'DELIVERED')])}
        units={units}
        showUnitFilter={true}
      />,
    )
    expect(screen.getByText('o1')).toBeInTheDocument()
    expect(screen.getByText('o2')).toBeInTheDocument()
  })

  it('shows the empty state when there are no orders', () => {
    renderWithIntl(
      <OrderBoard initial={page([])} units={units} showUnitFilter={true} />,
    )
    expect(
      screen.getByText(/no orders match these filters/i),
    ).toBeInTheDocument()
  })

  it('refetches page 1 with the selected status filter, dropping any cursor', async () => {
    const user = userEvent.setup()
    mockedClientFetch.mockResolvedValue(page([makeOrder('o9', 'PREPARING')]))
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1')], 'cursor-1')}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(screen.getByRole('option', { name: /^in preparation$/i }))

    await waitFor(() => expect(mockedClientFetch).toHaveBeenCalled())
    const call = mockedClientFetch.mock.calls.at(-1)!
    expect(call[0]).toBe('/api/admin/orders')
    expect(call[1]).toMatchObject({
      query: expect.objectContaining({
        orderStatus: 'PREPARING',
        cursor: undefined,
      }),
    })
    await waitFor(() => expect(screen.getByText('o9')).toBeInTheDocument())
  })

  it('applies the kitchen queue preset (PREPARING, oldest first)', async () => {
    const user = userEvent.setup()
    mockedClientFetch.mockResolvedValue(page([]))
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1')])}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /kitchen queue/i }))

    await waitFor(() => expect(mockedClientFetch).toHaveBeenCalled())
    const call = mockedClientFetch.mock.calls.at(-1)!
    expect(call[1]).toMatchObject({
      query: expect.objectContaining({
        orderStatus: 'PREPARING',
        sortDir: 'asc',
      }),
    })
  })

  it('loads and appends the next page, de-duplicating ids', async () => {
    const user = userEvent.setup()
    mockedClientFetch.mockResolvedValue(
      page([makeOrder('o2'), makeOrder('o3')]),
    )
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1'), makeOrder('o2')], 'cursor-2')}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getByText('o3')).toBeInTheDocument())

    const rows = screen.getAllByRole('row')
    // header + 3 data rows
    expect(rows).toHaveLength(4)
  })

  it('shows the advance-status action and moves the order forward on click', async () => {
    const user = userEvent.setup()
    const updated = makeOrder('o1', 'CONFIRMED')
    const fetchFn = mockRowFetch(200, updated)
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1', 'PENDING')])}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^confirm$/i }))

    expect(fetchFn).toHaveBeenCalledWith('/api/orders/o1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderStatus: 'CONFIRMED' }),
    })
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getByText(/^confirmed$/i),
      ).toBeInTheDocument(),
    )
  })

  it('only shows Cancel while PENDING or CONFIRMED', () => {
    renderWithIntl(
      <OrderBoard
        initial={page([
          makeOrder('o1', 'PENDING'),
          makeOrder('o2', 'PREPARING'),
        ])}
        units={units}
        showUnitFilter={true}
      />,
    )
    const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i })
    expect(cancelButtons).toHaveLength(1)
  })

  it('cancels an order', async () => {
    const user = userEvent.setup()
    const cancelled = makeOrder('o1', 'CANCELLED')
    const fetchFn = mockRowFetch(200, cancelled)
    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1', 'PENDING')])}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(fetchFn).toHaveBeenCalledWith('/api/orders/o1/cancel', {
      method: 'POST',
    })
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getByText(/^cancelled$/i),
      ).toBeInTheDocument(),
    )
  })

  it('re-fetches the single order on a 409 conflict instead of blindly retrying', async () => {
    const user = userEvent.setup()
    const fresh = makeOrder('o1', 'PREPARING')
    const fetchFn = vi
      .fn()
      // PATCH .../status → 409
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ code: 'conflict' }),
      } as Response)
      // GET /api/orders/o1 refetch → fresh order
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => fresh,
      } as Response)
    vi.stubGlobal('fetch', fetchFn)

    renderWithIntl(
      <OrderBoard
        initial={page([makeOrder('o1', 'CONFIRMED')])}
        units={units}
        showUnitFilter={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /start preparing/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2))
    expect(fetchFn).toHaveBeenNthCalledWith(2, '/api/orders/o1', {
      cache: 'no-store',
    })
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getByText(/in preparation/i),
      ).toBeInTheDocument(),
    )
  })
})
