// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { Category } from '@/lib/api/types'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { CategoryList } from './CategoryList'

function cat(over: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Burgers',
    description: 'Beef',
    isActive: true,
    createdAt: '',
    updatedAt: '2026-07-01T12:00:00Z',
    ...over,
  }
}

afterEach(cleanup)

describe('CategoryList', () => {
  it('renders the empty state', () => {
    renderWithIntl(<CategoryList categories={[]} />)
    expect(screen.getByText(/no active categories/i)).toBeInTheDocument()
  })

  it('renders a category with its status and an edit link', () => {
    renderWithIntl(<CategoryList categories={[cat()]} />)
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Burgers')).toBeInTheDocument()
    expect(table.getByText('Beef')).toBeInTheDocument()
    expect(table.getByText('Active')).toBeInTheDocument()
    expect(table.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/admin/categories/c1',
    )
  })

  it('shows the inactive status and a dash for a missing description', () => {
    renderWithIntl(
      <CategoryList
        categories={[cat({ isActive: false, description: null })]}
      />,
    )
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Inactive')).toBeInTheDocument()
    expect(table.getByText('—')).toBeInTheDocument()
  })
})
