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

import { CheckoutView } from './CheckoutView'

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

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/orders')
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
})
