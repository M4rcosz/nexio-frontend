// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Category } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { CategoryFilter } from '@/components/catalog/CategoryFilter'

const categories: Category[] = [
  {
    id: 'c1',
    name: 'Burgers',
    description: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'c2',
    name: 'Drinks',
    description: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
]

afterEach(cleanup)

describe('CategoryFilter', () => {
  it('renders an "All" pill plus one per category', () => {
    renderWithIntl(<CategoryFilter categories={categories} unitId="bu-1" />)
    expect(screen.getByRole('link', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Burgers' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Drinks' })).toBeInTheDocument()
  })

  it('builds category hrefs scoped to the unit', () => {
    renderWithIntl(<CategoryFilter categories={categories} unitId="bu-1" />)
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/units/bu-1',
    )
    expect(screen.getByRole('link', { name: 'Burgers' })).toHaveAttribute(
      'href',
      '/units/bu-1?categoryId=c1',
    )
  })

  it('preserves an active search term in every pill href', () => {
    renderWithIntl(
      <CategoryFilter categories={categories} unitId="bu-1" search="fry" />,
    )
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/units/bu-1?search=fry',
    )
    expect(screen.getByRole('link', { name: 'Drinks' })).toHaveAttribute(
      'href',
      '/units/bu-1?search=fry&categoryId=c2',
    )
  })

  it('marks the selected category pill active (brand style)', () => {
    renderWithIntl(
      <CategoryFilter categories={categories} unitId="bu-1" selected="c1" />,
    )
    // The active pill carries the brand-gradient class; "All" is inactive.
    expect(screen.getByRole('link', { name: 'Burgers' }).className).toMatch(
      /brand-gradient/,
    )
    expect(screen.getByRole('link', { name: 'All' }).className).not.toMatch(
      /brand-gradient/,
    )
  })
})
