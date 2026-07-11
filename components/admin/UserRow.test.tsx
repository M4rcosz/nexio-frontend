// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import messages from '@/messages/en.json'
import type { PublicBusinessUnit, User } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { UserRow } from './UserRow'

const staff: User = {
  id: 'u1',
  username: 'bob',
  name: 'Bob Staff',
  email: 'bob@example.com',
  phone: null,
  role: 'ATTENDANT',
  businessUnitIds: ['bu-1', 'bu-2'],
  isActive: true,
}

const unit: PublicBusinessUnit = {
  id: 'bu-1',
  name: 'Downtown',
  address: '',
  city: '',
  phone: '',
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

// UserRow renders a <tr>, so mount it inside a valid table structure.
function renderRow(user: User = staff, u: PublicBusinessUnit | null = unit) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <table>
        <tbody>
          <UserRow user={user} unit={u} />
        </tbody>
      </table>
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UserRow', () => {
  it('renders the user identity, role, unit (+extra), and status', () => {
    renderRow()
    expect(screen.getByText('Bob Staff')).toBeInTheDocument()
    expect(screen.getByText(/bob · bob@example\.com/)).toBeInTheDocument()
    expect(screen.getByText('Attendant')).toBeInTheDocument()
    // Primary unit name + "+1" for the second bound unit.
    expect(screen.getByText(/Downtown/)).toBeInTheDocument()
    expect(screen.getByText(/\+1/)).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('disables an active user after confirmation and posts the new state', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/admin/users/u1/active')
    expect(JSON.parse(init.body)).toEqual({ isActive: false })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    // Optimistic flip: the button now offers to re-enable.
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument()
  })

  it('does nothing when the disable confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    expect(fetchFn).not.toHaveBeenCalled()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('reverts the optimistic state and shows an error on failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(500, {})
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    // Reverted back to active — the Disable action is available again.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Disable' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('enables an inactive user without a confirmation prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderRow({ ...staff, isActive: false })

    await user.click(screen.getByRole('button', { name: 'Enable' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      isActive: true,
    })
  })
})
