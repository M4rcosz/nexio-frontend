import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AdminContext } from '@/lib/auth/access'

const serverFetch = vi.fn()

vi.mock('./client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
  USE_MOCKS: false,
}))

const { listCustomers, listInternalUsers } = await import('./admin-users')

function page(data: unknown[] = []) {
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

const ADMIN: AdminContext = {
  userId: 'usr_admin',
  role: 'ADMIN',
  scopedBusinessUnitIds: null,
  scopedBusinessUnitId: null,
  manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
}

const MANAGER: AdminContext = {
  userId: 'usr_manager',
  role: 'MANAGER',
  scopedBusinessUnitIds: ['bu_1'],
  scopedBusinessUnitId: 'bu_1',
  manageableRoles: ['ATTENDANT', 'KITCHEN'],
}

/** The `query` object handed to serverFetch on the most recent call. */
function lastQuery(): Record<string, unknown> {
  const call = serverFetch.mock.calls.at(-1)
  return (call?.[1] as { query: Record<string, unknown> }).query
}

/** Same, for the first call — the page the caller actually asked for. */
function firstQuery(): Record<string, unknown> {
  const call = serverFetch.mock.calls[0]
  return (call?.[1] as { query: Record<string, unknown> }).query
}

beforeEach(() => {
  serverFetch.mockReset()
  serverFetch.mockResolvedValue(page())
})

describe('listInternalUsers', () => {
  it('sends the role filter to the backend instead of over-fetching', async () => {
    await listInternalUsers(ADMIN, { role: 'ATTENDANT' })
    expect(lastQuery().role).toBe('ATTENDANT')
    // The old implementation asked for 100 rows and filtered in memory.
    expect(lastQuery().limit).toBe(20)
  })

  it('forwards the cursor and returns the pagination envelope untouched', async () => {
    serverFetch.mockResolvedValue({
      data: [{ id: 'u1', role: 'ATTENDANT' }],
      meta: { limit: 20, nextCursor: 'cur_2', hasMore: true },
    })
    const result = await listInternalUsers(ADMIN, { cursor: 'cur_1' })
    expect(firstQuery().cursor).toBe('cur_1')
    expect(serverFetch).toHaveBeenCalledTimes(1)
    expect(result.meta).toEqual({
      limit: 20,
      nextCursor: 'cur_2',
      hasMore: true,
    })
  })

  it('drops a role the actor cannot manage rather than forwarding it', async () => {
    // A MANAGER asking for ADMINs must not have that reach the backend.
    await listInternalUsers(MANAGER, { role: 'ADMIN' })
    expect(lastQuery().role).toBeUndefined()
  })

  it('makes exactly one request regardless of what the post-filter strips', async () => {
    // Re-fetching to fill a stripped page would make the round-trip count
    // depend on rows the actor may not see, turning latency into an oracle
    // for counting them (`limit` is client-controlled down to 1). One request
    // in, one page out — the resulting dead end is handled in the UI instead.
    serverFetch.mockResolvedValue({
      data: [
        { id: 'm1', role: 'MANAGER' },
        { id: 'm2', role: 'MANAGER' },
      ],
      meta: { limit: 2, nextCursor: 'm2', hasMore: true },
    })
    const result = await listInternalUsers(MANAGER, { limit: 2 })
    expect(result.data).toEqual([])
    expect(result.meta.hasMore).toBe(true)
    expect(serverFetch).toHaveBeenCalledTimes(1)
  })

  it('does not claim hasMore when the upstream page has no cursor', async () => {
    // Would otherwise render a Load more button with nothing to send.
    serverFetch.mockResolvedValue({
      data: [{ id: 'a1', role: 'ATTENDANT' }],
      meta: { limit: 20, nextCursor: null, hasMore: true },
    })
    const result = await listInternalUsers(MANAGER)
    expect(result.meta.hasMore).toBe(false)
  })

  it('filters out rows outside the actor manageable roles', async () => {
    serverFetch.mockResolvedValue(
      page([
        { id: 'u1', role: 'ATTENDANT' },
        { id: 'u2', role: 'ADMIN' },
      ]),
    )
    const result = await listInternalUsers(MANAGER)
    expect(result.data.map((u) => u.id)).toEqual(['u1'])
  })
})

describe('listCustomers', () => {
  it('asks the backend for role=CUSTOMER with no unit filter', async () => {
    await listCustomers(ADMIN, { search: 'carla' })
    const query = lastQuery()
    expect(query.role).toBe('CUSTOMER')
    expect(query.username).toBe('carla')
    // AND-combining a unit would collapse the page to empty — customers hold
    // no unit links (docs §1.3).
    expect(query.businessUnitId).toBeUndefined()
  })

  it('returns an empty page for a MANAGER without calling the backend', async () => {
    const result = await listCustomers(MANAGER)
    expect(result.data).toEqual([])
    expect(result.meta.hasMore).toBe(false)
    expect(serverFetch).not.toHaveBeenCalled()
  })
})
