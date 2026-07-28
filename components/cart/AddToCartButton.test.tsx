// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'
import type { ProductResponseDto } from '@/lib/api/types'
import { AddToCartButton } from '@/components/cart/AddToCartButton'

const product: ProductResponseDto = {
  id: 'p1',
  name: 'Burger',
  description: null,
  price: '25.90',
  isActive: true,
  categoryId: 'c1',
  imageUrl: null,
  createdAt: '',
  updatedAt: '',
}

function renderButton(unitId = 'bu-1') {
  return renderWithIntl(
    <AddToCartButton product={product} unitId={unitId} unitName="Downtown" />,
  )
}

beforeEach(() => {
  useCartStore.getState().clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AddToCartButton', () => {
  it('adds the product to the cart and shows transient feedback', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /add to cart/i }))

    const state = useCartStore.getState()
    expect(state.businessUnitId).toBe('bu-1')
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({
      productId: 'p1',
      unitPrice: '25.90',
    })
    expect(screen.getByRole('button')).toHaveTextContent(/added/i)
  })

  it('adds directly (no dialog) when the cart is empty or the unit matches', async () => {
    const user = userEvent.setup()
    useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
    renderButton('bu-1')
    await user.click(screen.getByRole('button', { name: /add to cart/i }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('prompts before switching units and adds when confirmed', async () => {
    const user = userEvent.setup()
    useCartStore.getState().setBusinessUnit('bu-OTHER', 'Airport')
    useCartStore.getState().addItem({
      productId: 'old',
      name: 'Old',
      unitPrice: '9.00',
      imageUrl: null,
    })
    renderButton('bu-1')
    await user.click(screen.getByRole('button', { name: /add to cart/i }))

    // In-app dialog, not window.confirm — nothing is added until it's accepted.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(useCartStore.getState().businessUnitId).toBe('bu-OTHER')

    await user.click(screen.getByRole('button', { name: /switch and empty/i }))

    const state = useCartStore.getState()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // Switching units clears the old item, then adds the new one.
    expect(state.businessUnitId).toBe('bu-1')
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('p1')
  })

  it('does nothing when the unit-switch dialog is cancelled', async () => {
    const user = userEvent.setup()
    useCartStore.getState().setBusinessUnit('bu-OTHER', 'Airport')
    useCartStore.getState().addItem({
      productId: 'old',
      name: 'Old',
      unitPrice: '9.00',
      imageUrl: null,
    })
    renderButton('bu-1')
    await user.click(screen.getByRole('button', { name: /add to cart/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    const state = useCartStore.getState()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(state.businessUnitId).toBe('bu-OTHER')
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('old')
  })

  it('clears the feedback label after the ~1.8s timeout', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(screen.getByRole('button')).toHaveTextContent(/added/i)

    // The label auto-resets via a 1800ms setTimeout; wait it out on the real clock.
    await waitFor(
      () =>
        expect(screen.getByRole('button')).toHaveTextContent(/add to cart/i),
      { timeout: 3000 },
    )
  })
})
