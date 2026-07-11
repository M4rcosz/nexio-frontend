// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { InitStockForm } from './InitStockForm'

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

function renderForm(onAdjustRequest?: (id: string) => void) {
  return renderWithIntl(
    <InitStockForm
      businessUnitId="bu-1"
      products={products}
      onAdjustRequest={onAdjustRequest}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('InitStockForm', () => {
  it('creates a stock row (quantity may be 0) and shows success', async () => {
    const fetchFn = mockFetch(201, {})
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Reason'), 'Initial count')
    await user.click(screen.getByRole('button', { name: /create stock row/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/inventory/bu-1/items')
    // The unit is in the URL and must never appear in the body.
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ productId: 'p1', quantity: 0, minQuantity: 0 })
    expect(body).not.toHaveProperty('businessUnitId')
    expect(await screen.findByRole('status')).toHaveTextContent(
      /stock row created/i,
    )
  })

  it('shows the generic failure message for an unmapped error', async () => {
    mockFetch(500, { code: 'boom' })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Reason'), 'x')
    await user.click(screen.getByRole('button', { name: /create stock row/i }))

    // 5xx with no specific mapping falls back to the shared server message.
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i)
  })

  it('offers the adjust CTA on inventory_exists and hands the product back', async () => {
    mockFetch(409, { code: 'inventory_exists' })
    const onAdjustRequest = vi.fn()
    const user = userEvent.setup()
    renderForm(onAdjustRequest)
    await user.type(screen.getByLabelText('Reason'), 'x')
    await user.click(screen.getByRole('button', { name: /create stock row/i }))

    const cta = await screen.findByRole('button', { name: /go to adjustment/i })
    await user.click(cta)
    expect(onAdjustRequest).toHaveBeenCalledWith('p1')
  })
})
