// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Promotion } from '@/lib/api/types'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { PromotionList } from './PromotionList'

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'promo1',
    businessUnitId: 'bu-1',
    name: 'Launch deal',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minOrderValue: '30.00',
    startDate: '2026-08-01T10:00:00Z',
    endDate: '2026-08-31T10:00:00Z',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

afterEach(cleanup)

describe('PromotionList', () => {
  it('renders the empty state when there are no promotions', () => {
    renderWithIntl(<PromotionList promotions={[]} />)
    expect(screen.getByText(/no promotions for this unit/i)).toBeInTheDocument()
  })

  it('formats a percentage discount', () => {
    renderWithIntl(<PromotionList promotions={[promo()]} />)
    // "{value}% off" in both the card and the table row.
    expect(screen.getAllByText(/10\.00% off/i).length).toBeGreaterThanOrEqual(1)
  })

  it('formats a fixed-amount discount with the money formatter', () => {
    renderWithIntl(
      <PromotionList
        promotions={[
          promo({ discountType: 'FIXED_AMOUNT', discountValue: '15.00' }),
        ]}
      />,
    )
    // "{money} off" — the formatter renders 15.00 (with a currency symbol).
    expect(
      screen.getAllByText(/15[.,]00\s*off/i).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('shows the active/inactive status and links to the editor', () => {
    renderWithIntl(<PromotionList promotions={[promo({ isActive: false })]} />)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1)
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/admin/promotions/promo1',
    )
  })

  it('derives scheduled/expired/active from the date window', () => {
    renderWithIntl(
      <PromotionList
        promotions={[
          promo({
            id: 'p-active',
            startDate: '2000-01-01T00:00:00Z',
            endDate: '2999-01-01T00:00:00Z',
          }),
          promo({ id: 'p-scheduled', startDate: '2999-01-01T00:00:00Z' }),
          promo({
            id: 'p-expired',
            startDate: '2000-01-01T00:00:00Z',
            endDate: '2000-02-01T00:00:00Z',
          }),
        ]}
      />,
    )
    const table = screen.getByRole('table')
    expect(within(table).getByText('Active')).toBeInTheDocument()
    expect(within(table).getByText('Scheduled')).toBeInTheDocument()
    expect(within(table).getByText('Expired')).toBeInTheDocument()
  })

  it('toggles isActive from the list and refreshes', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchFn)
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    renderWithIntl(<PromotionList promotions={[promo({ isActive: true })]} />)
    const table = screen.getByRole('table')
    await user.click(within(table).getByRole('button', { name: /deactivate/i }))

    expect(fetchFn).toHaveBeenCalledWith('/api/promotions/promo1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.unstubAllGlobals()
  })
})
