// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { AddMenuItemForm } from './AddMenuItemForm'

const products = [
  { id: 'p1', name: 'Burger' },
  { id: 'p2', name: 'Fries' },
]

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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AddMenuItemForm', () => {
  it('rejects a non-positive price before calling the API', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderWithIntl(
      <AddMenuItemForm businessUnitId="bu-1" products={products} />,
    )

    await user.type(screen.getByLabelText('Unit price'), '0')
    await user.click(screen.getByRole('button', { name: /add to menu/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /positive decimal/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('posts the menu item and shows success', async () => {
    const fetchFn = mockFetch(201, {})
    const user = userEvent.setup()
    renderWithIntl(
      <AddMenuItemForm businessUnitId="bu-1" products={products} />,
    )

    await user.type(screen.getByLabelText('Unit price'), '58.90')
    await user.click(screen.getByRole('button', { name: /add to menu/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/business-units/bu-1/menu')
    expect(JSON.parse(init.body)).toEqual({
      productId: 'p1',
      customPrice: '58.90',
      isAvailable: true,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      /added to the menu/i,
    )
  })

  it('maps menu_item_exists to a friendly message', async () => {
    mockFetch(409, { code: 'menu_item_exists' })
    const user = userEvent.setup()
    renderWithIntl(
      <AddMenuItemForm businessUnitId="bu-1" products={products} />,
    )

    await user.type(screen.getByLabelText('Unit price'), '58.90')
    await user.click(screen.getByRole('button', { name: /add to menu/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already on the menu/i,
    )
  })
})
