// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { Order, OrderItem, OrderStatus } from '@/lib/api/types'

import { OrderTracker } from './OrderTracker'

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

  it('hides the cancel button once the order is READY', () => {
    mockFetch(200, order('READY'))
    renderWithIntl(<OrderTracker initialOrder={order('READY')} />)
    expect(
      screen.queryByRole('button', { name: /cancel order/i }),
    ).not.toBeInTheDocument()
  })

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
})
