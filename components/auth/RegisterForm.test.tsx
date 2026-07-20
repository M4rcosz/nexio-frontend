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

import { RegisterForm } from '@/components/auth/RegisterForm'

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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
  await user.type(screen.getByLabelText('E-mail'), 'jane@example.com')
  await user.type(screen.getByLabelText('Username'), 'janedoe')
  await user.type(screen.getByLabelText(/^Password/), 'NewPass123')
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RegisterForm', () => {
  it('shows a live username hint for an invalid username without submitting', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderWithIntl(<RegisterForm />)
    await user.type(screen.getByLabelText('Username'), 'Jane') // uppercase → pattern

    expect(screen.getByText(/lowercase letters/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('omits an empty phone from the payload and navigates home on success', async () => {
    const fetchFn = mockFetch(201, {})
    const user = userEvent.setup()
    renderWithIntl(<RegisterForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body).toMatchObject({ username: 'janedoe', name: 'Jane Doe' })
    expect(body.phone).toBeUndefined()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
  })

  it('routes to /login when the server says requiresLogin', async () => {
    mockFetch(200, { requiresLogin: true })
    const user = userEvent.setup()
    renderWithIntl(<RegisterForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('surfaces a mapped error on a 409 conflict', async () => {
    mockFetch(409, { code: 'already_exists' })
    const user = userEvent.setup()
    renderWithIntl(<RegisterForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already registered/i,
    )
    expect(push).not.toHaveBeenCalled()
  })
})
