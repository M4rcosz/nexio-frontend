// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { MenuItem } from '@/lib/api/types'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { MenuManageTable } from './MenuManageTable'

function menuItem(over: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'm1',
    businessUnitId: 'bu-1',
    productId: 'p1',
    customPrice: '25.90',
    isAvailable: true,
    createdAt: '',
    updatedAt: '2026-07-01T12:00:00Z',
    ...over,
  }
}

const productNames = { p1: 'Burger' }

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

function renderTable(items: MenuItem[] = [menuItem()]) {
  renderWithIntl(
    <MenuManageTable
      businessUnitId="bu-1"
      items={items}
      productNames={productNames}
    />,
  )
}

// The component renders both a mobile card list and a desktop table; scope
// interactions to the desktop <table> to avoid duplicate matches.
function table() {
  return within(screen.getByRole('table'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MenuManageTable', () => {
  it('renders the empty state', () => {
    renderTable([])
    expect(screen.getByText(/no products on this unit/i)).toBeInTheDocument()
  })

  it('renders the product name, price, and availability badge', () => {
    renderTable()
    expect(table().getByText('Burger')).toBeInTheDocument()
    expect(table().getByText(/25[.,]90/)).toBeInTheDocument()
    expect(table().getByText('Available')).toBeInTheDocument()
  })

  it('optimistically toggles availability and posts the change', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderTable()

    await user.click(table().getByRole('button', { name: 'Disable' }))
    // Optimistic flip is immediate.
    expect(table().getByText('Unavailable')).toBeInTheDocument()
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/business-units/bu-1/menu/m1/available')
    expect(JSON.parse(init.body)).toEqual({ isAvailable: false })
  })

  it('reverts the availability toggle when the request fails', async () => {
    mockFetch(500, {})
    const user = userEvent.setup()
    renderTable()

    await user.click(table().getByRole('button', { name: 'Disable' }))
    await waitFor(() =>
      expect(table().getByText('Available')).toBeInTheDocument(),
    )
    expect(table().getByRole('alert')).toBeInTheDocument()
  })

  it('edits the price inline and PATCHes the new value', async () => {
    const fetchFn = mockFetch(200, menuItem({ customPrice: '30.00' }))
    const user = userEvent.setup()
    renderTable()

    await user.click(table().getByRole('button', { name: /edit price/i }))
    const input = table().getByPlaceholderText('58.90')
    await user.clear(input)
    await user.type(input, '30.00')
    await user.click(table().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/business-units/bu-1/menu/m1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ customPrice: '30.00' })
    await waitFor(() =>
      expect(table().getByText(/30[.,]00/)).toBeInTheDocument(),
    )
  })

  it('rejects an invalid inline price without calling the API', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderTable()

    await user.click(table().getByRole('button', { name: /edit price/i }))
    const input = table().getByPlaceholderText('58.90')
    await user.clear(input)
    await user.type(input, '0')
    await user.click(table().getByRole('button', { name: 'Save' }))

    expect(table().getByRole('alert')).toHaveTextContent(/positive decimal/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('cancels an inline edit', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(table().getByRole('button', { name: /edit price/i }))
    expect(table().getByPlaceholderText('58.90')).toBeInTheDocument()
    await user.click(table().getByRole('button', { name: 'Cancel' }))
    expect(table().queryByPlaceholderText('58.90')).not.toBeInTheDocument()
    expect(table().getByText(/25[.,]90/)).toBeInTheDocument()
  })
})
