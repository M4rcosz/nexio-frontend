// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const replace = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/users',
}))

import { FilterBar, FilterSearch } from './FilterBar'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('FilterBar', () => {
  it('syncs non-empty values into the query string, dropping empty ones', async () => {
    render(
      <FilterBar values={{ search: 'bob', role: '', businessUnitId: 'bu-1' }}>
        <span>child</span>
      </FilterBar>,
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/admin/users?search=bob&businessUnitId=bu-1',
      ),
    )
  })

  it('replaces with the bare pathname when every value is empty', async () => {
    render(
      <FilterBar values={{ search: '', role: '' }}>
        <span>child</span>
      </FilterBar>,
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/users'))
  })

  it('debounces updates when the values change', async () => {
    const { rerender } = render(
      <FilterBar values={{ search: 'a' }}>
        <span>child</span>
      </FilterBar>,
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/admin/users?search=a'),
    )
    replace.mockClear()

    rerender(
      <FilterBar values={{ search: 'ab' }}>
        <span>child</span>
      </FilterBar>,
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/admin/users?search=ab'),
    )
  })

  it('renders its children (search field and controls)', () => {
    render(
      <FilterBar values={{ search: '' }}>
        <FilterSearch aria-label="Search" />
      </FilterBar>,
    )
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })
})
