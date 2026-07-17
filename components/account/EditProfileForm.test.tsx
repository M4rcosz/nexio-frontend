// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { EditProfileForm } from '@/components/account/EditProfileForm'

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

function renderForm(name = 'Ana', phone = '1199999999') {
  return renderWithIntl(
    <EditProfileForm initialName={name} initialPhone={phone} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('EditProfileForm', () => {
  it('bails out when nothing changed', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /change your name or phone/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('sends only the changed field and shows success', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderForm('Ana', '1199999999')

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Maria')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    // Only the name changed — phone must not be sent (never wipe an untouched field).
    expect(body).toEqual({ name: 'Ana Maria' })
    expect(await screen.findByRole('status')).toHaveTextContent(
      /profile updated/i,
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('maps a phone_taken code to its message', async () => {
    mockFetch(409, { code: 'phone_taken' })
    const user = userEvent.setup()
    renderForm('Ana', '1199999999')

    const phoneInput = screen.getByLabelText('Phone')
    await user.clear(phoneInput)
    await user.type(phoneInput, '1188888888')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /phone number already in use/i,
    )
  })
})
