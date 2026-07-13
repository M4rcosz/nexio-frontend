// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { Category, ProductResponseDto } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { ProductForm } from './ProductForm'

const CAT_ID = '11111111-1111-1111-1111-111111111111'
const categories: Category[] = [
  {
    id: CAT_ID,
    name: 'Burgers',
    description: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
]

const product: ProductResponseDto = {
  id: 'p1',
  name: 'Burger',
  description: 'Tasty',
  price: '25.90',
  isActive: true,
  categoryId: CAT_ID,
  imageUrl: 'https://cdn.example.com/a.png',
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

describe('ProductForm (create)', () => {
  it('rejects an invalid price before calling the API', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderWithIntl(<ProductForm mode="create" categories={categories} />)

    await user.type(screen.getByLabelText('Name'), 'Fries')
    await user.type(screen.getByLabelText('Price'), '0')
    await user.type(
      screen.getByLabelText('Image URL'),
      'https://cdn.example.com/f.png',
    )
    await user.click(screen.getByRole('button', { name: /create product/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /positive decimal/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects a non-http image URL', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderWithIntl(<ProductForm mode="create" categories={categories} />)

    await user.type(screen.getByLabelText('Name'), 'Fries')
    await user.type(screen.getByLabelText('Price'), '9.90')
    await user.type(screen.getByLabelText('Image URL'), 'ftp://cdn/f.png')
    await user.click(screen.getByRole('button', { name: /create product/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid http/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('POSTs a valid product and redirects to the list', async () => {
    const fetchFn = mockFetch(201, { id: 'p9' })
    const user = userEvent.setup()
    renderWithIntl(<ProductForm mode="create" categories={categories} />)

    await user.type(screen.getByLabelText('Name'), 'Fries')
    await user.type(screen.getByLabelText('Price'), '9.90')
    await user.type(
      screen.getByLabelText('Image URL'),
      'https://cdn.example.com/f.png',
    )
    await user.click(screen.getByRole('button', { name: /create product/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/products')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      name: 'Fries',
      price: '9.90',
      categoryId: CAT_ID,
      imageUrl: 'https://cdn.example.com/f.png',
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/products'))
  })

  it('surfaces a mapped server error (e.g. 409 name_taken)', async () => {
    mockFetch(409, { code: 'name_taken' })
    const user = userEvent.setup()
    renderWithIntl(<ProductForm mode="create" categories={categories} />)

    await user.type(screen.getByLabelText('Name'), 'Fries')
    await user.type(screen.getByLabelText('Price'), '9.90')
    await user.type(
      screen.getByLabelText('Image URL'),
      'https://cdn.example.com/f.png',
    )
    await user.click(screen.getByRole('button', { name: /create product/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/name already/i)
    expect(push).not.toHaveBeenCalled()
  })
})

describe('ProductForm (edit)', () => {
  it('PATCHes only the changed field', async () => {
    const fetchFn = mockFetch(200, {})
    const user = userEvent.setup()
    renderWithIntl(
      <ProductForm mode="edit" product={product} categories={categories} />,
    )

    const priceInput = screen.getByLabelText('Price')
    await user.clear(priceInput)
    await user.type(priceInput, '30.00')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/products/p1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ price: '30.00' })
  })

  it('blocks a no-op edit with the noChanges message', async () => {
    const fetchFn = mockFetch(200)
    const user = userEvent.setup()
    renderWithIntl(
      <ProductForm mode="edit" product={product} categories={categories} />,
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /change at least one field/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
