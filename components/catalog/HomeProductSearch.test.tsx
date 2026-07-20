// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'
import type { ProductResponseDto } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: ReactNode
    href: string
    onClick?: () => void
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}))

import { HomeProductSearch } from '@/components/catalog/HomeProductSearch'

function product(over: Partial<ProductResponseDto> = {}): ProductResponseDto {
  return {
    id: 'p1',
    name: 'Cheeseburger',
    description: null,
    price: '25.90',
    isActive: true,
    categoryId: 'c1',
    imageUrl: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

function mockFetch(data: ProductResponseDto[]) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
  useCartStore.getState().clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HomeProductSearch', () => {
  it('does not search for queries shorter than 2 characters', async () => {
    // The length guard is independent of the debounce timer, so assert it
    // directly rather than sleeping past a real-clock debounce window: type a
    // 2-char query (which DOES fetch) then a 1-char one, and confirm the second
    // never reaches the network.
    const fetchFn = mockFetch([product()])
    const user = userEvent.setup()
    renderWithIntl(<HomeProductSearch defaultUnitId="bu-1" />)
    const input = screen.getByLabelText(/search the catalog/i)

    await user.type(input, 'ab')
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1))

    fetchFn.mockClear()
    await user.clear(input)
    await user.type(input, 'a')
    // A short query resets results synchronously and never schedules a fetch.
    await waitFor(() =>
      expect(screen.queryByRole('link')).not.toBeInTheDocument(),
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('debounces, queries the API, and lists matching products', async () => {
    const fetchFn = mockFetch([product({ name: 'Cheeseburger' })])
    const user = userEvent.setup()
    renderWithIntl(<HomeProductSearch defaultUnitId="bu-1" />)

    await user.type(screen.getByLabelText(/search the catalog/i), 'chee')
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    expect(fetchFn.mock.calls[0][0]).toContain('/api/products?search=chee')

    const link = await screen.findByRole('link', { name: /cheeseburger/i })
    // Falls back to the default unit for the result href.
    expect(link).toHaveAttribute('href', '/units/bu-1/products/p1')
  })

  it('targets the cart unit over the default when one is set', async () => {
    mockFetch([product()])
    useCartStore.getState().setBusinessUnit('bu-cart', 'Cart Unit')
    const user = userEvent.setup()
    renderWithIntl(<HomeProductSearch defaultUnitId="bu-1" />)

    await user.type(screen.getByLabelText(/search the catalog/i), 'chee')
    const link = await screen.findByRole('link', { name: /cheeseburger/i })
    expect(link).toHaveAttribute('href', '/units/bu-cart/products/p1')
  })

  it('shows the empty message when there are no matches', async () => {
    mockFetch([])
    const user = userEvent.setup()
    renderWithIntl(<HomeProductSearch defaultUnitId="bu-1" />)

    await user.type(screen.getByLabelText(/search the catalog/i), 'zzz')
    expect(await screen.findByText(/no items found/i)).toBeInTheDocument()
  })
})
