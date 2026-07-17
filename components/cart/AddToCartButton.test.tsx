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

  it('adds directly (no confirm) when the cart is empty or the unit matches', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
    renderButton('bu-1')
    await user.click(screen.getByRole('button', { name: /add to cart/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('prompts before switching units and adds when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
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

    const state = useCartStore.getState()
    expect(window.confirm).toHaveBeenCalled()
    // Switching units clears the old item, then adds the new one.
    expect(state.businessUnitId).toBe('bu-1')
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('p1')
  })

  it('does nothing when the unit-switch prompt is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
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

    const state = useCartStore.getState()
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
