// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

const replace = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

import { AccountGoneRedirect } from './AccountGoneRedirect'

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

describe('AccountGoneRedirect', () => {
  it('shows the goodbye message', () => {
    renderWithIntl(<AccountGoneRedirect />)
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
  })

  it('logs out, clears the cart, and redirects to login on mount', async () => {
    useCartStore.getState().setBusinessUnit('bu-1', 'Downtown')
    useCartStore.getState().addItem({
      productId: 'p1',
      name: 'A',
      unitPrice: '1.00',
      imageUrl: null,
    })

    renderWithIntl(<AccountGoneRedirect />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      expect(replace).toHaveBeenCalledWith('/login')
      expect(refresh).toHaveBeenCalled()
    })
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('still redirects when the logout request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderWithIntl(<AccountGoneRedirect />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })
})
