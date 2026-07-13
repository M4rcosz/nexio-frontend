// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { Category } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { CategoryForm } from './CategoryForm'

const category: Category = {
  id: 'c1',
  name: 'Burgers',
  description: 'Beef',
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

describe('CategoryForm (create)', () => {
  it('rejects a too-short name client-side', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderWithIntl(<CategoryForm mode="create" />)

    await user.type(screen.getByLabelText('Name'), 'A')
    await user.click(screen.getByRole('button', { name: /create category/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /at least 2 characters/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('omits an empty description and posts the category', async () => {
    const fetchFn = mockFetch(201, { id: 'c9' })
    const user = userEvent.setup()
    renderWithIntl(<CategoryForm mode="create" />)

    await user.type(screen.getByLabelText('Name'), 'Drinks')
    await user.click(screen.getByRole('button', { name: /create category/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/categories')
    expect(JSON.parse(init.body)).toEqual({ name: 'Drinks' })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/categories'))
  })
})

describe('CategoryForm (edit)', () => {
  it('keeps submit disabled until a field changes', async () => {
    const user = userEvent.setup()
    renderWithIntl(<CategoryForm mode="edit" category={category} />)
    const submit = screen.getByRole('button', { name: /save changes/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), ' Deluxe')
    expect(submit).toBeEnabled()
  })

  it('PATCHes the isActive toggle (soft delete)', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderWithIntl(<CategoryForm mode="edit" category={category} />)

    await user.click(screen.getByRole('checkbox', { name: /active/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/categories/c1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ isActive: false })
  })
})
