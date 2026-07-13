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

import { LoginForm } from './LoginForm'

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

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Username'), '  admin  ')
  await user.type(screen.getByLabelText('Password'), 'secret12')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LoginForm', () => {
  it('submits a trimmed username and the raw password', async () => {
    const fetchFn = mockFetch(200, { role: 'CUSTOMER' })
    const user = userEvent.setup()
    renderWithIntl(<LoginForm redirectTo={null} />)
    await fillAndSubmit(user)

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body).toEqual({ username: 'admin', password: 'secret12' })
  })

  it('navigates to the role landing page on success when no redirect is given', async () => {
    mockFetch(200, { role: 'ADMIN' })
    const user = userEvent.setup()
    renderWithIntl(<LoginForm redirectTo={null} />)
    await fillAndSubmit(user)

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/admin')
      expect(refresh).toHaveBeenCalled()
    })
  })

  it('honors an explicit redirect target over the role landing', async () => {
    mockFetch(200, { role: 'ADMIN' })
    const user = userEvent.setup()
    renderWithIntl(<LoginForm redirectTo="/orders/o1" />)
    await fillAndSubmit(user)

    await waitFor(() => expect(push).toHaveBeenCalledWith('/orders/o1'))
  })

  it('shows the invalid-credentials message on a 401', async () => {
    mockFetch(401)
    const user = userEvent.setup()
    renderWithIntl(<LoginForm redirectTo={null} />)
    await fillAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid username or password/i,
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('maps a coded 5xx error via the shared error catalog', async () => {
    mockFetch(503, { code: 'server' })
    const user = userEvent.setup()
    renderWithIntl(<LoginForm redirectTo={null} />)
    await fillAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i)
  })
})
