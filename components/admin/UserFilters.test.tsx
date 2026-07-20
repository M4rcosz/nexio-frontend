// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { PublicBusinessUnit, Role } from '@/lib/api/types'

const replace = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/users',
}))

import { UserFilters } from './UserFilters'

const units: PublicBusinessUnit[] = [
  { id: 'bu-1', name: 'Downtown', address: '', city: '', phone: '' },
]
const ROLES: Role[] = ['ATTENDANT', 'KITCHEN', 'MANAGER']

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('UserFilters', () => {
  it('renders the search box and role filter, hiding the unit filter when not allowed', () => {
    renderWithIntl(
      <UserFilters
        units={units}
        initial={{}}
        showUnitFilter={false}
        manageableRoles={ROLES}
      />,
    )
    expect(
      screen.getByPlaceholderText(/search by username/i),
    ).toBeInTheDocument()
    // Role Select present; unit Select absent (only one combobox).
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('shows the unit filter when permitted', () => {
    renderWithIntl(
      <UserFilters
        units={units}
        initial={{}}
        showUnitFilter
        manageableRoles={ROLES}
      />,
    )
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('pushes the typed search into the URL query (debounced)', async () => {
    const user = userEvent.setup()
    renderWithIntl(
      <UserFilters
        units={units}
        initial={{}}
        showUnitFilter={false}
        manageableRoles={ROLES}
      />,
    )
    await user.type(screen.getByPlaceholderText(/search by username/i), 'bob')
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/admin/users?search=bob'),
    )
  })

  it('seeds the controls from the initial filter values', async () => {
    renderWithIntl(
      <UserFilters
        units={units}
        initial={{ search: 'ana', role: 'MANAGER' }}
        showUnitFilter={false}
        manageableRoles={ROLES}
      />,
    )
    expect(screen.getByDisplayValue('ana')).toBeInTheDocument()
    // The role Select shows the seeded role label on its trigger.
    expect(screen.getByRole('combobox')).toHaveTextContent('Manager')
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/admin/users?search=ana&role=MANAGER',
      ),
    )
  })
})
