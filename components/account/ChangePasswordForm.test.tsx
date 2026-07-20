// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { ChangePasswordForm } from '@/components/account/ChangePasswordForm'

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

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  { current = 'OldPass123', next = 'NewPass123', confirm = 'NewPass123' } = {},
) {
  await user.type(screen.getByLabelText('Current password'), current)
  await user.type(screen.getByLabelText('New password'), next)
  await user.type(screen.getByLabelText('Confirm new password'), confirm)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ChangePasswordForm', () => {
  it('rejects a mismatch client-side without calling the API', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderWithIntl(<ChangePasswordForm />)
    await fill(user, { next: 'NewPass123', confirm: 'Different99' })
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't match/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects a weak new password client-side', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderWithIntl(<ChangePasswordForm />)
    // 10 lowercase chars: only 1 class → invalid.
    await fill(user, { next: 'abcdefghij', confirm: 'abcdefghij' })
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/stronger/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('submits and bounces to /login on success', async () => {
    const fetchFn = mockFetch(200, { ok: true })
    const user = userEvent.setup()
    renderWithIntl(<ChangePasswordForm />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body).toEqual({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('maps a wrong_password code to its message', async () => {
    mockFetch(401, { code: 'wrong_password' })
    const user = userEvent.setup()
    renderWithIntl(<ChangePasswordForm />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /current password is incorrect/i,
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('maps a same_password code to its message', async () => {
    mockFetch(422, { code: 'same_password' })
    const user = userEvent.setup()
    renderWithIntl(<ChangePasswordForm />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /must differ from the current/i,
    )
  })
})
