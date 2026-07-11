// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { CartView } from './CartView'

function seed(items: { productId: string; name: string; quantity: number }[]) {
  useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
  for (const it of items) {
    useCartStore.getState().addItem({
      productId: it.productId,
      name: it.name,
      unitPrice: '10.00',
      imageUrl: null,
      quantity: it.quantity,
    })
  }
}

beforeEach(() => {
  useCartStore.getState().clear()
})

afterEach(cleanup)

describe('CartView', () => {
  it('renders the empty state when there are no items', async () => {
    renderWithIntl(<CartView />)
    await waitFor(() =>
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/view units/i)).toBeInTheDocument()
  })

  it('lists items with the ordering-from unit and a total', async () => {
    seed([{ productId: 'p1', name: 'Burger', quantity: 2 }])
    renderWithIntl(<CartView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())
    expect(screen.getByText(/order for downtown/i)).toBeInTheDocument()
    // 2 x 10.00 = 20.00 shows as both the line subtotal and the summary total.
    expect(screen.getAllByText(/20[.,]00/).length).toBeGreaterThanOrEqual(1)
  })

  it('increments and decrements quantity via the steppers', async () => {
    seed([{ productId: 'p1', name: 'Burger', quantity: 1 }])
    const user = userEvent.setup()
    renderWithIntl(<CartView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    const row = screen.getByText('Burger').closest('li') as HTMLElement
    await user.click(within(row).getByRole('button', { name: '+' }))
    expect(useCartStore.getState().items[0].quantity).toBe(2)
    await user.click(within(row).getByRole('button', { name: '−' }))
    expect(useCartStore.getState().items[0].quantity).toBe(1)
  })

  it('removes a line and edits its notes', async () => {
    seed([
      { productId: 'p1', name: 'Burger', quantity: 1 },
      { productId: 'p2', name: 'Fries', quantity: 1 },
    ])
    const user = userEvent.setup()
    renderWithIntl(<CartView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    const burgerRow = screen.getByText('Burger').closest('li') as HTMLElement
    await user.type(
      within(burgerRow).getByPlaceholderText(/notes/i),
      'no onion',
    )
    expect(
      useCartStore.getState().items.find((i) => i.productId === 'p1')?.notes,
    ).toBe('no onion')

    await user.click(within(burgerRow).getByRole('button', { name: /remove/i }))
    expect(screen.queryByText('Burger')).not.toBeInTheDocument()
    expect(screen.getByText('Fries')).toBeInTheDocument()
  })

  it('empties the cart via the clear button', async () => {
    seed([{ productId: 'p1', name: 'Burger', quantity: 1 }])
    const user = userEvent.setup()
    renderWithIntl(<CartView />)
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /empty cart/i }))
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })
})
