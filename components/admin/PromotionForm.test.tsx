// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { PublicBusinessUnit } from '@/lib/api/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

import { PromotionForm } from './PromotionForm'

const units: PublicBusinessUnit[] = [
  { id: 'bu-1', name: 'Downtown', address: '', city: '', phone: '' },
]

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

async function fillBase(
  user: ReturnType<typeof userEvent.setup>,
  { discount = '10.00', min = '30.00' } = {},
) {
  await user.type(screen.getByLabelText('Name'), 'Launch deal')
  await user.type(screen.getByLabelText('Discount value'), discount)
  await user.type(screen.getByLabelText('Minimum order value'), min)
}

function setDates(start: string, end: string) {
  fireEvent.change(screen.getByLabelText('Starts at'), {
    target: { value: start },
  })
  fireEvent.change(screen.getByLabelText('Ends at'), {
    target: { value: end },
  })
}

function renderCreate(scoped: string | null = null) {
  return renderWithIntl(
    <PromotionForm mode="create" units={units} scopedBusinessUnitId={scoped} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PromotionForm (create)', () => {
  it('rejects a non-decimal money value', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderCreate()
    await fillBase(user, { discount: 'abc' })
    setDates('2026-08-01T10:00', '2026-08-02T10:00')
    await user.click(screen.getByRole('button', { name: /create promotion/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /decimal amount/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects a percentage discount above 100', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderCreate()
    await fillBase(user, { discount: '150' }) // PERCENTAGE is the default
    setDates('2026-08-01T10:00', '2026-08-02T10:00')
    await user.click(screen.getByRole('button', { name: /create promotion/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot exceed 100/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects an end date that is not after the start', async () => {
    const fetchFn = mockFetch(201)
    const user = userEvent.setup()
    renderCreate()
    await fillBase(user)
    setDates('2026-08-02T10:00', '2026-08-01T10:00')
    await user.click(screen.getByRole('button', { name: /create promotion/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /end date must be after/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('POSTs a valid promotion with ISO dates and the default unit', async () => {
    const fetchFn = mockFetch(201, { id: 'promo-9' })
    const user = userEvent.setup()
    renderCreate()
    await fillBase(user)
    setDates('2026-08-01T10:00', '2026-08-02T10:00')
    await user.click(screen.getByRole('button', { name: /create promotion/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/promotions')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      businessUnitId: 'bu-1',
      name: 'Launch deal',
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      minOrderValue: '30.00',
    })
    // Dates are serialized to ISO 8601.
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
    expect(new Date(body.endDate) > new Date(body.startDate)).toBe(true)
    // Carries the unit through, so the list opens on the board the promotion
    // was just added to rather than defaulting to `units[0]`.
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        '/admin/promotions?businessUnitId=bu-1',
      ),
    )
  })

  it('forces the scoped unit for a MANAGER regardless of the field', async () => {
    const fetchFn = mockFetch(201, {})
    const user = userEvent.setup()
    renderCreate('bu-1')
    await fillBase(user)
    setDates('2026-08-01T10:00', '2026-08-02T10:00')
    await user.click(screen.getByRole('button', { name: /create promotion/i }))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).businessUnitId).toBe(
      'bu-1',
    )
  })
})
