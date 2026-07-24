// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { AiMembershipManager } from './AiMembershipManager'

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const USERS = [
  { id: 'u1', name: 'Ana', username: 'ana', role: 'MANAGER' as const },
]

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

describe('AiMembershipManager', () => {
  it('starts the initial balance at 0', () => {
    renderWithIntl(<AiMembershipManager users={USERS} />)
    expect(screen.getByLabelText('Initial balance')).toHaveValue(0)
  })

  it('steps the initial balance without going negative', async () => {
    const user = userEvent.setup()
    renderWithIntl(<AiMembershipManager users={USERS} />)
    const field = screen.getByLabelText('Initial balance')

    await user.click(
      screen.getByRole('button', { name: 'Increase Initial balance' }),
    )
    expect(field).toHaveValue(1000)
    // Two presses down from 1000 would be −1000; a grant clamps at zero.
    await user.click(
      screen.getByRole('button', { name: 'Decrease Initial balance' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Decrease Initial balance' }),
    )
    expect(field).toHaveValue(0)
  })

  it('lets the delta go negative — a clawback is a signed adjustment', async () => {
    const user = userEvent.setup()
    renderWithIntl(<AiMembershipManager users={USERS} />)
    await user.click(screen.getByRole('button', { name: 'Decrease Delta' }))
    expect(screen.getByLabelText('Delta')).toHaveValue(-1000)
  })

  it('explains the missing target instead of offering a dead button', async () => {
    const user = userEvent.setup()
    renderWithIntl(<AiMembershipManager users={USERS} />)

    const grant = screen.getByRole('button', { name: 'Grant access' })
    expect(grant).toBeEnabled()
    await user.click(grant)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a target user first.',
    )
    // The guard runs before any request is built.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing target from the adjust and revoke actions too', async () => {
    const user = userEvent.setup()
    renderWithIntl(<AiMembershipManager users={USERS} />)

    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a target user first.',
    )

    // Revoke asks for confirmation first; the guard fires on the way out.
    await user.click(screen.getByRole('button', { name: 'Revoke access' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Revoke access' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a target user first.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
