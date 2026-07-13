// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Promotion } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
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
})
