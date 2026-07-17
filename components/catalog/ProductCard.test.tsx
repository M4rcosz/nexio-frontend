// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { ProductResponseDto } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { ProductCard } from '@/components/catalog/ProductCard'

const product: ProductResponseDto = {
  id: 'p1',
  name: 'Cheeseburger',
  description: 'Double patty',
  price: '25.90',
  isActive: true,
  categoryId: 'c1',
  imageUrl: 'https://cdn.example.com/a.png',
  createdAt: '',
  updatedAt: '',
}

afterEach(cleanup)

describe('ProductCard', () => {
  it('links to the product detail page and shows name, description, and price', () => {
    renderWithIntl(
      <ProductCard product={product} unitId="bu-1" unitName="Downtown" />,
    )
    const link = screen.getByRole('link', { name: 'Cheeseburger' })
    expect(link).toHaveAttribute('href', '/units/bu-1/products/p1')
    expect(screen.getByText('Double patty')).toBeInTheDocument()
    expect(screen.getByText(/25[.,]90/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add to cart/i }),
    ).toBeInTheDocument()
  })

  it('renders the product image with its name as alt text', () => {
    renderWithIntl(
      <ProductCard product={product} unitId="bu-1" unitName="Downtown" />,
    )
    const img = screen.getByAltText('Cheeseburger')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/a.png')
  })

  it('falls back to a placeholder glyph when there is no image', () => {
    renderWithIntl(
      <ProductCard
        product={{ ...product, imageUrl: null, description: null }}
        unitId="bu-1"
        unitName="Downtown"
      />,
    )
    expect(screen.queryByAltText('Cheeseburger')).not.toBeInTheDocument()
    // Description is omitted when null.
    expect(screen.queryByText('Double patty')).not.toBeInTheDocument()
  })
})
