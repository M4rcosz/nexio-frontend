// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

// The i18n router is out of scope for a unit test — stub push/refresh so we can
// assert the logout side effects (fetch, cart clear, navigation) in isolation.
const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { LogoutButton } from '@/components/auth/LogoutButton'

beforeEach(() => {
  vi.clearAllMocks()
  useCartStore.getState().clear()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LogoutButton', () => {
  it('calls the logout endpoint, clears the cart, and navigates home', async () => {
    const user = userEvent.setup()
    useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
    useCartStore.getState().addItem({
      productId: 'p1',
      name: 'A',
      unitPrice: '1.00',
      imageUrl: null,
    })

    renderWithIntl(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      expect(push).toHaveBeenCalledWith('/')
      expect(refresh).toHaveBeenCalled()
    })
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().businessUnitId).toBeNull()
  })
})
