import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/access')>()),
  getAdminContext: vi.fn(),
}))
vi.mock('@/lib/api/admin-users')

import { getAdminContext } from '@/lib/auth/access'
import { getInternalUser, updateInternalUser } from '@/lib/api/admin-users'
import { PATCH } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedUpdate = vi.mocked(updateInternalUser)
const mockedGet = vi.mocked(getInternalUser)

const USER_ID = '33333333-3333-4333-8333-333333333333'
const BU_ID = '11111111-1111-4111-8111-111111111111'

function patchReq(body: unknown): Request {
  return new Request(`http://localhost/api/admin/users/${USER_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ id: USER_ID }) }

/** Error shape thrown by `lib/api/admin-users` — a plain Error plus a `code`. */
function coded(code: string, message = 'nope') {
  return Object.assign(new Error(message), { code })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedCtx.mockResolvedValue({
    userId: 'admin-1',
    role: 'ADMIN',
    scopedBusinessUnitIds: null,
    scopedBusinessUnitId: null,
    manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
  })
  mockedGet.mockResolvedValue(null)
})

describe('PATCH /api/admin/users/[id]', () => {
  it('returns 403 without an admin context', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await PATCH(patchReq({ name: 'X' }), params)
    expect(res.status).toBe(403)
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('passes a units-only patch through and returns the user', async () => {
    mockedUpdate.mockResolvedValue({ id: USER_ID } as never)
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(res.status).toBe(200)
  })

  // A MANAGER's unit change is refused outright rather than silently dropped —
  // dropping it made the request look like an empty unit set, so the actor was
  // told to assign a unit while looking at the units they had just ticked.
  it('maps unit_change_forbidden to 403', async () => {
    mockedUpdate.mockRejectedValue(coded('unit_change_forbidden'))
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'unit_change_forbidden' })
  })

  // "Not built yet" is a permanent product state, not a server fault: a 5xx
  // would count against the error SLO and render as "try again shortly".
  it('maps profile_edit_unsupported to 409, not a 5xx', async () => {
    mockedUpdate.mockRejectedValue(coded('profile_edit_unsupported'))
    const res = await PATCH(patchReq({ name: 'New Name' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      code: 'profile_edit_unsupported',
    })
  })

  // Same code and status the create handler already uses for this rule.
  it('maps unit_required to 400', async () => {
    mockedUpdate.mockRejectedValue(coded('unit_required'))
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'unit_required' })
  })

  it('rejects a role the actor may not manage before calling the service', async () => {
    mockedCtx.mockResolvedValue({
      userId: 'mgr-1',
      role: 'MANAGER',
      scopedBusinessUnitIds: [BU_ID],
      scopedBusinessUnitId: BU_ID,
      manageableRoles: ['ATTENDANT', 'KITCHEN'],
    })
    const res = await PATCH(patchReq({ role: 'ADMIN' }), params)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'role_forbidden' })
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when the user is not visible to the actor', async () => {
    mockedUpdate.mockResolvedValue(null)
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(res.status).toBe(404)
  })

  // A genuine upstream 4xx keeps its status instead of being flattened to 500
  // and reported to the user as "the server is unavailable".
  it('preserves an upstream 4xx status', async () => {
    mockedUpdate.mockRejectedValue(new ApiError(409, null, 'Conflict.'))
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(res.status).toBe(409)
  })

  // Backend prose must never reach the browser — it can carry internal detail.
  it('never forwards a raw upstream message', async () => {
    mockedUpdate.mockRejectedValue(
      new ApiError(
        422,
        { message: 'internal detail leak' },
        'internal detail leak',
      ),
    )
    const res = await PATCH(patchReq({ businessUnitIds: [BU_ID] }), params)
    expect(JSON.stringify(await res.json())).not.toContain('internal detail')
  })

  it('returns 400 for a malformed payload', async () => {
    const res = await PATCH(patchReq({ role: 'WIZARD' }), params)
    expect(res.status).toBe(400)
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})
