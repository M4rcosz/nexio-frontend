// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { LoyaltyAccount } from '@/lib/api/types'

import { LoyaltyView } from '@/components/loyalty/LoyaltyView'

function account(over: Partial<LoyaltyAccount> = {}): LoyaltyAccount {
  return {
    id: 'l1',
    customerId: 'c1',
    totalPoints: 120,
    consentGiven: true,
    consentDate: '2026-06-01T10:00:00Z',
    consentRevokedAt: null,
    createdAt: '',
    transactions: [
      {
        id: 't1',
        type: 'EARN',
        points: 20,
        description: 'Order #123',
        createdAt: '2026-06-02T10:00:00Z',
      },
    ],
    ...over,
  }
}

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

describe('LoyaltyView', () => {
  it('shows the balance and transaction history', () => {
    renderWithIntl(<LoyaltyView initial={account()} />)
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('Order #123')).toBeInTheDocument()
    expect(screen.getByText('+20')).toBeInTheDocument()
  })

  it('shows a zero balance and the consent prompt when there is no account', () => {
    renderWithIntl(<LoyaltyView initial={null} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /accept and continue/i }),
    ).toBeInTheDocument()
  })

  it('grants consent via POST and reflects the returned account', async () => {
    const fetchFn = mockFetch(
      200,
      account({ totalPoints: 0, transactions: [] }),
    )
    const user = userEvent.setup()
    renderWithIntl(<LoyaltyView initial={null} />)

    await user.click(
      screen.getByRole('button', { name: /accept and continue/i }),
    )
    await waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith('/api/loyalty/me/consent', {
        method: 'POST',
      }),
    )
    // Now consent is active → the revoke button appears.
    expect(
      await screen.findByRole('button', { name: /revoke consent/i }),
    ).toBeInTheDocument()
  })

  it('revokes consent via DELETE', async () => {
    const fetchFn = mockFetch(200, account({ consentGiven: false }))
    const user = userEvent.setup()
    renderWithIntl(<LoyaltyView initial={account()} />)

    await user.click(screen.getByRole('button', { name: /revoke consent/i }))
    await waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith('/api/loyalty/me/consent', {
        method: 'DELETE',
      }),
    )
    expect(
      await screen.findByRole('button', { name: /accept and continue/i }),
    ).toBeInTheDocument()
  })

  it('surfaces an error when the consent request fails', async () => {
    mockFetch(500, {})
    const user = userEvent.setup()
    renderWithIntl(<LoyaltyView initial={null} />)

    await user.click(
      screen.getByRole('button', { name: /accept and continue/i }),
    )
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
