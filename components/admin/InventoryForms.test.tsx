// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { InventoryForms } from './InventoryForms'

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

describe('InventoryForms', () => {
  it('renders both the adjust and init stock forms', () => {
    renderWithIntl(<InventoryForms businessUnitId="bu-1" products={products} />)
    expect(
      screen.getByRole('button', { name: /apply adjustment/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create stock row/i }),
    ).toBeInTheDocument()
  })

  it('seeds the init form when an adjustment reports no existing balance', async () => {
    // Adjust POST 404 -> the "initialize stock" CTA appears; clicking it hands
    // the product + quantity (default 1) to the init form.
    mockFetch(404, { code: 'inventory_not_found' })
    const user = userEvent.setup()
    renderWithIntl(<InventoryForms businessUnitId="bu-1" products={products} />)

    // The init form's initial quantity starts at 0.
    expect(screen.getByLabelText('Initial quantity')).toHaveValue(0)

    // Both forms have a "Reason" field; the adjust form renders first.
    await user.type(screen.getAllByLabelText('Reason')[0], 'restock')
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }))

    const cta = await screen.findByRole('button', {
      name: /initialize stock for this product/i,
    })
    await user.click(cta)

    // The handoff prefilled the init quantity with the adjustment quantity (1).
    await waitFor(() =>
      expect(screen.getByLabelText('Initial quantity')).toHaveValue(1),
    )
  })
})
