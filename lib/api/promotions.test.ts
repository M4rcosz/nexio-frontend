// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError } from './errors'
import type { Paginated } from './types'

const serverFetchAnonymous = vi.fn()
const serverFetch = vi.fn()

// USE_MOCKS is read from the environment at module load; pin it to false so the
// suite always exercises the real fetch path.
vi.mock('./client', () => ({
  USE_MOCKS: false,
  serverFetch: (...args: unknown[]) => serverFetch(...args),
  serverFetchAnonymous: (...args: unknown[]) => serverFetchAnonymous(...args),
}))

const { listActivePromotions, listPublicPromotions } =
  await import('./promotions')

const UNIT = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

function offer(over: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    businessUnitId: UNIT,
    name: 'Almoço executivo',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minOrderValue: '30.00',
    endDate: '2026-12-31T23:59:59.000Z',
    ...over,
  }
}

function page(data: unknown[]): Paginated<never> {
  return {
    data: data as never[],
    meta: { limit: 20, nextCursor: 'opaque-token', hasMore: true },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  serverFetchAnonymous.mockResolvedValue(page([offer()]))
})

describe('listPublicPromotions', () => {
  it('calls the public route without a session', async () => {
    await listPublicPromotions(UNIT, { limit: 50 })
    // serverFetch (not Anonymous) would attach the JWT cookie; the public route
    // ignores it, and sending it would make the response user-specific.
    expect(serverFetch).not.toHaveBeenCalled()
    const [path, init] = serverFetchAnonymous.mock.calls[0]
    expect(path).toBe(`/promotions/public/by-business-unit/${UNIT}`)
    expect(init.query).toEqual({ limit: 50, cursor: undefined })
  })

  it('passes the cursor back verbatim and returns meta untouched', async () => {
    const res = await listPublicPromotions(UNIT, { cursor: 'opaque-token' })
    expect(serverFetchAnonymous.mock.calls[0][1].query.cursor).toBe(
      'opaque-token',
    )
    // The token is a keyset blob — never parsed, rebuilt or re-encoded.
    expect(res.meta.nextCursor).toBe('opaque-token')
  })

  it('drops rows whose discountType cannot be priced', async () => {
    // FREE_ITEM can no longer be created, but rows predating that check can
    // still exist in an older database — they must not reach the UI.
    serverFetchAnonymous.mockResolvedValue(
      page([
        offer({ id: 'a' }),
        offer({ id: 'b', discountType: 'FREE_ITEM' }),
        offer({ id: 'c', discountType: 'FIXED_AMOUNT' }),
      ]),
    )
    const res = await listPublicPromotions(UNIT)
    expect(res.data.map((p) => p.id)).toEqual(['a', 'c'])
  })
})

describe('listActivePromotions', () => {
  it('returns the offers the public route reports as running', async () => {
    expect((await listActivePromotions(UNIT)).map((p) => p.id)).toEqual([
      'promo-1',
    ])
  })

  it('degrades to an empty list when throttled, without logging', async () => {
    // The global throttle counts per IP and covers public routes, so a shared
    // NAT can hit a 429 with nothing wrong on our side.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    serverFetchAnonymous.mockRejectedValue(new ApiError(429, null, 'slow down'))
    expect(await listActivePromotions(UNIT)).toEqual([])
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('degrades to an empty list but logs any other failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    serverFetchAnonymous.mockRejectedValue(new ApiError(500, null, 'boom'))
    expect(await listActivePromotions(UNIT)).toEqual([])
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
