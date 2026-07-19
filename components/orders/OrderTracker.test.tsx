// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { Order, OrderItem, OrderStatus } from '@/lib/api/types'

import { OrderTracker } from '@/components/orders/OrderTracker'

const item: OrderItem = {
  id: 'i1',
  productId: 'p1',
  productName: 'Burger',
  quantity: 2,
  unitPrice: '25.90',
  subtotal: '51.80',
  notes: null,
}

function order(status: OrderStatus): Order {
  return {
    id: 'o1',
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
    createdAt: '',
    updatedAt: '',
    updatedById: null,
    orderItems: [item],
  }
}

function mockFetch(status: number, body: unknown = {}) {
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
  vi.useRealTimers()
})

describe('OrderTracker', () => {
  it('renders the items, total, and a cancel button for a pending order', () => {
    mockFetch(200, order('PENDING'))
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)

    expect(screen.getByText('Burger')).toBeInTheDocument()
    expect(screen.getAllByText(/51[.,]80/).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('button', { name: /cancel order/i }),
    ).toBeInTheDocument()
  })

  it('itemizes points and promotion discounts when the total is below the item sum', () => {
    // Items sum 51.80; 20 pts redeemed → −2.00; remaining gap → promotion −5.18.
    const discounted = {
      ...order('DELIVERED'),
      pointsRedeemed: 20,
      totalAmount: '44.62',
    }
    mockFetch(200, discounted)
    renderWithIntl(<OrderTracker initialOrder={discounted} />)

    expect(screen.getByText(/subtotal/i)).toBeInTheDocument()
    expect(screen.getByText(/loyalty points \(20 pts\)/i)).toBeInTheDocument()
    expect(screen.getByText('−R$2.00')).toBeInTheDocument()
    expect(screen.getByText(/promotion discount/i)).toBeInTheDocument()
    expect(screen.getByText('−R$5.18')).toBeInTheDocument()
    expect(screen.getByText('R$44.62')).toBeInTheDocument()
  })

  it('hides the breakdown when nothing was discounted', () => {
    mockFetch(200, order('PENDING'))
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)
    expect(screen.queryByText(/subtotal/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/promotion discount/i)).not.toBeInTheDocument()
  })

  it('hides the cancel button once the order is READY', () => {
    mockFetch(200, order('READY'))
    renderWithIntl(<OrderTracker initialOrder={order('READY')} />)
    expect(
      screen.queryByRole('button', { name: /cancel order/i }),
    ).not.toBeInTheDocument()
  })

  it.each(['CONFIRMED', 'PREPARING'] as const)(
    'hides the cancel button once the order is %s (customer window is PENDING-only)',
    (status) => {
      mockFetch(200, order(status))
      renderWithIntl(<OrderTracker initialOrder={order(status)} />)
      expect(
        screen.queryByRole('button', { name: /cancel order/i }),
      ).not.toBeInTheDocument()
    },
  )

  it('cancels the order and reflects the CANCELLED state', async () => {
    const fetchFn = mockFetch(200, order('CANCELLED'))
    const user = userEvent.setup()
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)

    await user.click(screen.getByRole('button', { name: /cancel order/i }))
    await waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith('/api/orders/o1/cancel', {
        method: 'POST',
      }),
    )
    expect(await screen.findByText(/order cancelled\./i)).toBeInTheDocument()
    // Once cancelled, the cancel button is gone.
    expect(
      screen.queryByRole('button', { name: /cancel order/i }),
    ).not.toBeInTheDocument()
  })

  it('shows an error when cancellation fails', async () => {
    mockFetch(422, {})
    const user = userEvent.setup()
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)

    await user.click(screen.getByRole('button', { name: /cancel order/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not cancel/i,
    )
  })

  it('does not poll a terminal (DELIVERED) order', () => {
    const fetchFn = mockFetch(200, order('DELIVERED'))
    renderWithIntl(<OrderTracker initialOrder={order('DELIVERED')} />)
    // No cancel button, and the polling effect returns early → no fetch.
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('polls on an interval and applies the fetched order state', async () => {
    vi.useFakeTimers()
    const fetchFn = mockFetch(200, order('CANCELLED'))
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)

    // The 5s poll fires, resolves, and applies the new status.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetchFn).toHaveBeenCalledWith('/api/orders/o1', {
      cache: 'no-store',
    })
    expect(screen.getByText(/order cancelled\./i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cancel order/i }),
    ).not.toBeInTheDocument()
  })

  it('stops polling and surfaces a lost session on a 401 poll', async () => {
    vi.useFakeTimers()
    const fetchFn = mockFetch(401)
    renderWithIntl(<OrderTracker initialOrder={order('PENDING')} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i)
    // The interval was cleared — further ticks make no additional calls.
    const callsAfterFirst = fetchFn.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(fetchFn.mock.calls.length).toBe(callsAfterFirst)
  })
})
