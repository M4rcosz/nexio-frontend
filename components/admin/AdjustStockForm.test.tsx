// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { AdjustStockForm } from './AdjustStockForm'

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

function renderForm(onInitRequest?: (id: string, qty: number) => void) {
  return renderWithIntl(
    <AdjustStockForm
      businessUnitId="bu-1"
      products={products}
      onInitRequest={onInitRequest}
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

describe('AdjustStockForm', () => {
  it('posts an adjustment and shows a success message', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Reason'), 'Weekly restock')
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/inventory/bu-1/adjust')
    expect(JSON.parse(init.body)).toMatchObject({
      productId: 'p1',
      type: 'IN',
      quantity: 1,
      reason: 'Weekly restock',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      /stock updated/i,
    )
  })

  it('maps inventory_below_zero to its message', async () => {
    mockFetch(422, { code: 'inventory_below_zero' })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Reason'), 'x')
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/below zero/i)
  })

  it('maps inventory_over_max to its message', async () => {
    mockFetch(409, { code: 'inventory_over_max' })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Reason'), 'x')
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /exceed the maximum/i,
    )
  })

  it('offers the init CTA on inventory_not_found and hands the product back', async () => {
    mockFetch(404, { code: 'inventory_not_found' })
    const onInitRequest = vi.fn()
    const user = userEvent.setup()
    renderForm(onInitRequest)
    await user.type(screen.getByLabelText('Reason'), 'x')
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }))

    const cta = await screen.findByRole('button', {
      name: /initialize stock for this product/i,
    })
    await user.click(cta)
    expect(onInitRequest).toHaveBeenCalledWith('p1', 1)
  })
})
