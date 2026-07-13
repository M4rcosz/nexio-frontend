// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

// The localized <Link> needs routing context we don't care about here — render
// it as a plain anchor so we can assert the badge/preview content.
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
}))

import { CartBadge } from './CartBadge'

function addItem(over: { productId: string; quantity: number }) {
  useCartStore.getState().addItem({
    name: 'Burger',
    unitPrice: '25.90',
    imageUrl: null,
    ...over,
  })
}

beforeEach(() => {
  useCartStore.getState().clear()
})

afterEach(cleanup)

describe('CartBadge', () => {
  it('shows no count badge and an empty preview for an empty cart', async () => {
    renderWithIntl(<CartBadge />)
    await waitFor(() =>
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('shows the total item count once hydrated', async () => {
    addItem({ productId: 'p1', quantity: 2 })
    addItem({ productId: 'p2', quantity: 3 })
    renderWithIntl(<CartBadge />)
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })

  it('caps the badge at 99+', async () => {
    addItem({ productId: 'p1', quantity: 150 })
    renderWithIntl(<CartBadge />)
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
  })

  it('renders each line and a total in the preview', async () => {
    addItem({ productId: 'p1', quantity: 2 })
    renderWithIntl(<CartBadge />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())
    expect(screen.getByText(/view cart/i)).toBeInTheDocument()
    // 2 x 25.90 = 51.80 surfaces as both the line subtotal and the cart total.
    expect(screen.getAllByText(/51[.,]80/).length).toBeGreaterThanOrEqual(1)
  })
})
