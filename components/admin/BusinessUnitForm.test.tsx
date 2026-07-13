// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { BusinessUnit } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { BusinessUnitForm } from './BusinessUnitForm'

const unit: BusinessUnit = {
  id: 'bu-1',
  name: 'Downtown',
  cnpj: '12345678000199',
  address: 'Main St 1',
  city: 'Metropolis',
  phone: '1133334444',
  isActive: true,
  createdAt: '',
  updatedAt: '',
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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BusinessUnitForm (create)', () => {
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Name'), 'Downtown')
    await user.type(screen.getByLabelText('CNPJ'), '12345678000199')
    await user.type(screen.getByLabelText('Address'), 'Main St 1')
    await user.type(screen.getByLabelText('City'), 'Metropolis')
    await user.type(screen.getByLabelText('Phone'), '1133334444')
  }

  it('rejects a CNPJ without 14 digits', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderWithIntl(<BusinessUnitForm mode="create" />)
    await user.type(screen.getByLabelText('Name'), 'Downtown')
    await user.type(screen.getByLabelText('CNPJ'), '123')
    await user.type(screen.getByLabelText('Address'), 'Main St 1')
    await user.type(screen.getByLabelText('City'), 'Metropolis')
    await user.type(screen.getByLabelText('Phone'), '1133334444')
    await user.click(screen.getByRole('button', { name: /create unit/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cnpj must have 14 digits/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('strips the CNPJ mask and posts the 14 raw digits', async () => {
    const fetchFn = mockFetch(201, { id: 'bu-9' })
    const user = userEvent.setup()
    renderWithIntl(<BusinessUnitForm mode="create" />)
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /create unit/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/business-units')
    expect(JSON.parse(init.body)).toEqual({
      name: 'Downtown',
      cnpj: '12345678000199',
      address: 'Main St 1',
      city: 'Metropolis',
      phone: '1133334444',
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/admin/business-units'),
    )
  })
})

describe('BusinessUnitForm (edit)', () => {
  it('locks the CNPJ and PATCHes only changed fields', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderWithIntl(<BusinessUnitForm mode="edit" unit={unit} />)

    expect(screen.getByLabelText('CNPJ')).toBeDisabled()
    // Shows the masked CNPJ, read from the raw digits.
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-99')

    const cityInput = screen.getByLabelText('City')
    await user.clear(cityInput)
    await user.type(cityInput, 'Gotham')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/business-units/bu-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ city: 'Gotham' })
  })

  it('keeps submit disabled until a field changes', async () => {
    const user = userEvent.setup()
    renderWithIntl(<BusinessUnitForm mode="edit" unit={unit} />)
    const submit = screen.getByRole('button', { name: /save changes/i })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Name'), ' HQ')
    expect(submit).toBeEnabled()
  })
})
