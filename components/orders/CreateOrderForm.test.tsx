// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { CreateOrderForm } from './CreateOrderForm'
import type { PublicMenuItem } from '@/lib/api/types'

const products: PublicMenuItem[] = [
  {
    menuItemId: 'm1',
    productId: 'p1',
    name: 'Baião de dois',
    description: null,
    imageUrl: null,
    price: '42.00',
  },
]

function res(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function mockFetch(status = 201, body: unknown = { id: 'ord_1' }) {
  const fn = vi.fn().mockResolvedValue(res(status, body))
  vi.stubGlobal('fetch', fn)
  return fn
}

function orderBody(fn: ReturnType<typeof vi.fn>) {
  const call = fn.mock.calls.find(([url]) => url === '/api/orders')
  return call ? JSON.parse(call[1].body as string) : null
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function addOneItem(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Increase quantity' }))
}

describe('CreateOrderForm — TOTEM', () => {
  it('blocks submit and shows a name error when the name is blank', async () => {
    const fn = mockFetch()
    const user = userEvent.setup()
    renderWithIntl(
      <CreateOrderForm
        channel="TOTEM"
        businessUnitId="bu-1"
        products={products}
        onPlaced={vi.fn()}
      />,
    )
    await addOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    expect(
      await screen.findByText(
        'Enter a name with at least one letter or number.',
      ),
    ).toBeInTheDocument()
    expect(fn.mock.calls.some(([url]) => url === '/api/orders')).toBe(false)
  })

  it('submits a TOTEM order with the customerName and no customerId', async () => {
    const fn = mockFetch()
    const onPlaced = vi.fn()
    const user = userEvent.setup()
    renderWithIntl(
      <CreateOrderForm
        channel="TOTEM"
        businessUnitId="bu-1"
        products={products}
        onPlaced={onPlaced}
      />,
    )
    await addOneItem(user)
    await user.type(screen.getByLabelText('Name to call the order'), 'Maria')
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() => expect(onPlaced).toHaveBeenCalled())
    const body = orderBody(fn)
    expect(body).toMatchObject({
      orderChannel: 'TOTEM',
      customerName: 'Maria',
      orderItems: [{ productId: 'p1', quantity: 1, unitPrice: '42.00' }],
    })
    expect(body.customerId).toBeUndefined()
  })
})

describe('CreateOrderForm — COUNTER', () => {
  it('sends only customerName for a walk-in (never both fields)', async () => {
    const fn = mockFetch()
    const user = userEvent.setup()
    renderWithIntl(
      <CreateOrderForm
        channel="COUNTER"
        businessUnitId="bu-1"
        products={products}
        onPlaced={vi.fn()}
      />,
    )
    await addOneItem(user)
    await user.type(
      screen.getByLabelText('Name to call the order'),
      'Seu Antonio',
    )
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() =>
      expect(fn.mock.calls.some(([url]) => url === '/api/orders')).toBe(true),
    )
    const body = orderBody(fn)
    expect(body.customerName).toBe('Seu Antonio')
    expect(body.customerId).toBeUndefined()
  })

  it('sends only customerId when looking up a registered customer', async () => {
    const fn = mockFetch()
    const user = userEvent.setup()
    renderWithIntl(
      <CreateOrderForm
        channel="COUNTER"
        businessUnitId="bu-1"
        products={products}
        onPlaced={vi.fn()}
      />,
    )
    await addOneItem(user)
    await user.click(screen.getByRole('radio', { name: 'Registered customer' }))
    await user.type(
      screen.getByLabelText('Customer ID'),
      'f3b7c2e1-1a2b-4c4d-8e6f-7a8b9c0d1e2f',
    )
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() =>
      expect(fn.mock.calls.some(([url]) => url === '/api/orders')).toBe(true),
    )
    const body = orderBody(fn)
    expect(body.customerId).toBe('f3b7c2e1-1a2b-4c4d-8e6f-7a8b9c0d1e2f')
    expect(body.customerName).toBeUndefined()
  })
})
