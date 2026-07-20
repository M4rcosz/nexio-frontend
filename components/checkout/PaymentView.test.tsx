// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Payment } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { PaymentView } from '@/components/checkout/PaymentView'

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay1',
  orderId: 'o1',
  amount: '51.80',
  method: 'PIX',
  status: 'PENDING',
  extTransactionId: null,
  pixCode: '00020126BR-CODE',
  createdAt: '',
  updatedAt: '',
  ...over,
})

/**
 * Routes the polling GET and the action POST to separate handlers so we can
 * model "no payment yet, then the user pays".
 */
function routeFetch(handlers: {
  get?: () => { status: number; body?: unknown }
  post?: () => { status: number; body?: unknown }
}) {
  const fn = vi.fn(
    async (_url: string, init?: { method?: string; body?: string }) => {
      const h =
        (init?.method ?? 'GET') === 'POST' ? handlers.post : handlers.get
      const { status, body = {} } = h?.() ?? { status: 404 }
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      } as Response
    },
  )
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

describe('PaymentView', () => {
  it('shows the method selector and total when no payment exists yet', async () => {
    routeFetch({ get: () => ({ status: 404 }) })
    renderWithIntl(<PaymentView orderId="o1" amount="51.80" />)

    expect(
      await screen.findByRole('button', { name: /^pay$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/51[.,]80/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pix/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /credit card/i }),
    ).toBeInTheDocument()
  })

  it('starts a payment and renders the returned PIX code and status', async () => {
    const fetchFn = routeFetch({
      get: () => ({ status: 404 }),
      post: () => ({ status: 201, body: payment() }),
    })
    const user = userEvent.setup()
    renderWithIntl(<PaymentView orderId="o1" amount="51.80" />)

    await user.click(await screen.findByRole('button', { name: /^pay$/i }))

    await waitFor(() =>
      expect(screen.getByText('00020126BR-CODE')).toBeInTheDocument(),
    )
    // Status chip reflects the pending payment.
    expect(screen.getByText(/awaiting payment/i)).toBeInTheDocument()
    const postCall = fetchFn.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(JSON.parse(postCall![1]!.body!)).toEqual({ method: 'PIX' })
  })

  it('shows an error when starting the payment fails', async () => {
    routeFetch({
      get: () => ({ status: 404 }),
      post: () => ({ status: 422, body: {} }),
    })
    const user = userEvent.setup()
    renderWithIntl(<PaymentView orderId="o1" amount="51.80" />)

    await user.click(await screen.findByRole('button', { name: /^pay$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /failed to start payment/i,
    )
  })

  it('renders the track-order link once a polled payment is approved', async () => {
    routeFetch({
      get: () => ({ status: 200, body: payment({ status: 'APPROVED' }) }),
    })
    renderWithIntl(<PaymentView orderId="o1" amount="51.80" />)

    const link = await screen.findByRole('link', { name: /track order/i })
    expect(link).toHaveAttribute('href', '/orders/o1')
  })

  it('surfaces a lost session when polling returns 401', async () => {
    routeFetch({ get: () => ({ status: 401 }) })
    renderWithIntl(<PaymentView orderId="o1" amount="51.80" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /session has expired/i,
    )
  })
})
