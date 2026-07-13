// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'
import type { InventoryItem } from '@/lib/api/types'
import { InventoryTable } from './InventoryTable'

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    businessUnitId: 'bu-1',
    productId: 'p1',
    quantity: 10,
    minQuantity: 3,
    updatedAt: '2026-07-01T12:00:00Z',
    ...over,
  }
}

const productNames = { p1: 'Burger', p2: 'Fries' }

afterEach(cleanup)

describe('InventoryTable', () => {
  it('renders the empty state when there are no items', () => {
    renderWithIntl(<InventoryTable items={[]} productNames={productNames} />)
    expect(screen.getByText(/no stock balances/i)).toBeInTheDocument()
  })

  it('resolves product names from the id map', () => {
    renderWithIntl(
      <InventoryTable items={[item()]} productNames={productNames} />,
    )
    // Rendered in both the mobile card and the desktop table.
    expect(screen.getAllByText('Burger').length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to the product id when no name is mapped', () => {
    renderWithIntl(
      <InventoryTable
        items={[item({ productId: 'unknown' })]}
        productNames={productNames}
      />,
    )
    expect(screen.getAllByText('unknown').length).toBeGreaterThanOrEqual(1)
  })

  it('flags a low-stock row (quantity <= minQuantity) with the low badge', () => {
    renderWithIntl(
      <InventoryTable
        items={[item({ id: 'low', quantity: 2, minQuantity: 3 })]}
        productNames={productNames}
      />,
    )
    expect(screen.getAllByText('Low').length).toBeGreaterThanOrEqual(1)
  })

  it('does not flag a healthy row', () => {
    renderWithIntl(
      <InventoryTable
        items={[item({ quantity: 20, minQuantity: 3 })]}
        productNames={productNames}
      />,
    )
    expect(screen.queryByText('Low')).not.toBeInTheDocument()
  })
})
