// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { PublicBusinessUnit, Role, User } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { UserForm } from './UserForm'

const units: PublicBusinessUnit[] = [
  { id: 'bu-1', name: 'Downtown', address: '', city: '', phone: '' },
  { id: 'bu-2', name: 'Airport', address: '', city: '', phone: '' },
]

const ADMIN_ROLES: Role[] = ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN']

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

describe('UserForm (create)', () => {
  function renderCreate(
    manageableRoles = ADMIN_ROLES,
    scoped: string[] | null = null,
  ) {
    return renderWithIntl(
      <UserForm
        mode="create"
        units={units}
        scopedBusinessUnitIds={scoped}
        manageableRoles={manageableRoles}
      />,
    )
  }

  async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Full name'), 'Bob Staff')
    await user.type(screen.getByLabelText('E-mail'), 'bob@example.com')
    await user.type(screen.getByLabelText('Username'), 'bobstaff')
    await user.type(screen.getByLabelText(/^Password/), 'NewPass123')
  }

  it('requires at least one unit for a non-ADMIN role', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    // Default role is the first manageable role (ATTENDANT here) → unit required.
    renderCreate(['ATTENDANT', 'KITCHEN'])
    await fillIdentity(user)
    await user.click(screen.getByRole('button', { name: /create user/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /at least one business unit/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('POSTs a staff user with the selected units', async () => {
    const fetchFn = mockFetch(201, { id: 'u9' })
    const user = userEvent.setup()
    renderCreate(['ATTENDANT', 'KITCHEN'])
    await fillIdentity(user)
    await user.click(screen.getByRole('checkbox', { name: 'Downtown' }))
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/admin/users')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      username: 'bobstaff',
      role: 'ATTENDANT',
      businessUnitIds: ['bu-1'],
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/users'))
  })

  it('sends an empty unit list for the ADMIN role and hides the unit picker', async () => {
    const fetchFn = mockFetch(201, {})
    const user = userEvent.setup()
    renderCreate(['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'])
    await fillIdentity(user)

    // Switch the role Select to Administrator.
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(screen.getByRole('option', { name: 'Administrator' }))
    // Units picker is gone for ADMIN.
    expect(
      screen.queryByRole('checkbox', { name: 'Downtown' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create user/i }))
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body).toMatchObject({ role: 'ADMIN', businessUnitIds: [] })
  })

  it('maps a username_taken code to its message', async () => {
    mockFetch(409, { code: 'username_taken' })
    const user = userEvent.setup()
    renderCreate(['ATTENDANT'])
    await fillIdentity(user)
    await user.click(screen.getByRole('checkbox', { name: 'Downtown' }))
    await user.click(screen.getByRole('button', { name: /create user/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /username already taken/i,
    )
  })

  it('limits a MANAGER to their own units', () => {
    renderCreate(['ATTENDANT', 'KITCHEN'], ['bu-2'])
    // Only the in-scope unit is offered.
    expect(
      screen.getByRole('checkbox', { name: 'Airport' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: 'Downtown' }),
    ).not.toBeInTheDocument()
  })
})

describe('UserForm (edit)', () => {
  const staff: User = {
    id: 'u1',
    username: 'bobstaff',
    name: 'Bob Staff',
    email: 'bob@example.com',
    phone: null,
    role: 'ATTENDANT',
    businessUnitIds: ['bu-1'],
    isActive: true,
  }

  it('PATCHes without a password and locks the username', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderWithIntl(
      <UserForm
        mode="edit"
        user={staff}
        units={units}
        scopedBusinessUnitIds={null}
        manageableRoles={ADMIN_ROLES}
      />,
    )
    // Username is immutable on edit.
    expect(screen.getByLabelText('Username')).toBeDisabled()
    // No password field in edit mode.
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/admin/users/u1')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body)
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('username')
    expect(body).toMatchObject({ role: 'ATTENDANT', businessUnitIds: ['bu-1'] })
  })
})
