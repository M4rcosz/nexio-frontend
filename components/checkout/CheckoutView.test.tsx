// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

const push = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { CheckoutView } from '@/components/checkout/CheckoutView'

function res(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

/**
 * Stubs fetch for both calls the view makes: the promotions lookup on mount
 * (answered with `promotions`, empty by default) and the order submission
 * (answered with `status`/`body`).
 */
function mockFetch(
  status: number,
  body: unknown = {},
  promotions: unknown[] = [],
) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    if (url.startsWith('/api/promotions/active/')) {
      return res(200, { data: promotions })
    }
    return res(status, body)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function orderCalls(fn: ReturnType<typeof vi.fn>) {
  return fn.mock.calls.filter(([url]) => url === '/api/orders')
}

function seed() {
  useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
  useCartStore.getState().addItem({
    productId: 'p1',
    name: 'Burger',
    unitPrice: '25.90',
    imageUrl: null,
    quantity: 2,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useCartStore.getState().clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CheckoutView', () => {
  it('shows the empty state when the cart has no items', async () => {
    renderWithIntl(<CheckoutView />)
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })

  it('creates the order with an idempotency key and redirects to payment', async () => {
    const fetchFn = mockFetch(201, { id: 'order-9' })
    const user = userEvent.setup()
    seed()
    renderWithIntl(<CheckoutView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    await user.type(screen.getByLabelText(/order notes/i), 'ring the bell')
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }))

    await waitFor(() => expect(orderCalls(fetchFn)).toHaveLength(1))
    const [, init] = orderCalls(fetchFn)[0]
    expect(init.headers['idempotency-key']).toEqual(expect.any(String))
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      businessUnitId: 'bu-1',
      orderChannel: 'WEB',
      notes: 'ring the bell',
      orderItems: [{ productId: 'p1', quantity: 2, unitPrice: '25.90' }],
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/payment/order-9'))
    // The cart is emptied after a successful order.
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('redirects to login (preserving the return path) on a 401', async () => {
    mockFetch(401)
    const user = userEvent.setup()
    seed()
    renderWithIntl(<CheckoutView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /confirm and pay/i }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/login?redirect=/checkout'),
    )
    // The cart is preserved so the user can retry after signing in.
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('shows an error and keeps the cart on a server failure', async () => {
    mockFetch(422, {})
    const user = userEvent.setup()
    seed()
    renderWithIntl(<CheckoutView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /confirm and pay/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /failed to create order/i,
    )
    expect(push).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  // Cart subtotal in these tests: 2 × 25.90 = 51.80.
  const livePromo = {
    id: 'promo1',
    businessUnitId: 'bu-1',
    name: 'Lunch deal',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minOrderValue: '30.00',
    startDate: '2000-01-01T00:00:00.000Z',
    endDate: '2999-01-01T00:00:00.000Z',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }

  it('shows the estimated discount when a live promotion applies', async () => {
    mockFetch(201, { id: 'order-9' }, [livePromo])
    seed()
    renderWithIntl(<CheckoutView />)

    // 10% of 51.80 → −5.18, estimated total 46.62.
    expect(await screen.findByText(/estimated total/i)).toBeInTheDocument()
    expect(screen.getByText(/promotion — lunch deal/i)).toBeInTheDocument()
    expect(screen.getByText('−R$5.18')).toBeInTheDocument()
    expect(screen.getByText('R$46.62')).toBeInTheDocument()
  })

  it('nudges toward the nearest unlockable promotion minimum', async () => {
    mockFetch(201, { id: 'order-9' }, [
      { ...livePromo, minOrderValue: '100.00' },
    ])
    seed()
    renderWithIntl(<CheckoutView />)

    // 100.00 − 51.80 = 48.20 still missing; the plain total is kept
    // (51.80 shows twice: the item line and the total).
    expect(
      await screen.findByText(/add r\$48\.20 in items/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText('R$51.80')).toHaveLength(2)
    expect(screen.queryByText(/estimated total/i)).not.toBeInTheDocument()
  })
})
