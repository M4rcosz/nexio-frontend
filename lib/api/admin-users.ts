// Staff/admin user management on top of the real `/users` endpoints:
//   - GET  /users                       (list, cursor-paginated, filters)
//   - POST /users                       (create staff/admin)
//   - PATCH /users/:id/deactivate|reactivate
//   - PUT  /users/:id/business-units    (replace unit set, ADMIN only)
//
// The backend has no `GET /users/:id` nor a general profile PATCH, so those
// two operations are partially stubbed (see comments below).
//
// All functions accept an `AdminContext` so MANAGER calls are automatically
// scoped to their own business units and limited to the roles they may manage.
import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type { ListUsersQuery, Paginated, User } from './types'
import type { AdminContext } from '@/lib/auth/access'
import {
  type CreateInternalUserInput,
  type InternalUserFilters,
  type UpdateInternalUserInput,
  createInternalUserMock,
  getInternalUserMock,
  listCustomersMock,
  listInternalUsersMock,
  setInternalUserActiveMock,
  updateInternalUserMock,
} from './mocks/admin-users'

/** Matches the backend default; the server caps anything above 100. */
export const PAGE_LIMIT = 20
/** Used only by the id-walking fallback in `getInternalUser`. */
const SCAN_LIMIT = 100

async function fetchUsersPage(query: ListUsersQuery): Promise<Paginated<User>> {
  return serverFetch<Paginated<User>>('/users', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      businessUnitId: query.businessUnitId,
      username: query.username,
      email: query.email,
      role: query.role,
    },
    cache: 'no-store',
  })
}

/**
 * Staff listing, one cursor page at a time. `role` now goes to the backend as
 * a real query param instead of being applied to an over-fetched page.
 *
 * The post-filter on `manageableRoles` stays as a belt-and-braces guard for
 * the unfiltered case (a MANAGER must never see an ADMIN row).
 *
 * That filter runs *after* the backend has already paginated, so a page can
 * come back full and end up empty — a MANAGER pinned to their unit is served
 * the other MANAGERs of that unit, none of which they may manage.
 *
 * We deliberately do NOT re-fetch to fill such a page. Doing so makes the
 * number of backend round-trips depend on content the actor is forbidden to
 * see, which turns request latency into an oracle for counting those hidden
 * rows (`limit` is client-controlled down to 1). It also multiplies one
 * request into several sequential upstream calls, each with its own 4s
 * timeout, inside an RSC render.
 *
 * The dead end that would otherwise cause is handled in the UI instead:
 * `UserList` renders the Load more control alongside the empty state when
 * `hasMore` is set, so an empty page is a click-through rather than a wall.
 */

export async function listInternalUsers(
  ctx: AdminContext,
  filters: Omit<
    InternalUserFilters,
    'scopedBusinessUnitIds' | 'allowedRoles'
  > = {},
): Promise<Paginated<User>> {
  // A role the actor cannot manage would otherwise be forwarded verbatim and
  // answered with rows they have no business seeing.
  const role =
    filters.role && ctx.manageableRoles.includes(filters.role)
      ? filters.role
      : undefined

  if (USE_MOCKS) {
    return listInternalUsersMock({
      ...filters,
      role,
      scopedBusinessUnitIds: ctx.scopedBusinessUnitIds,
      allowedRoles: ctx.manageableRoles,
    })
  }
  const page = await fetchUsersPage({
    limit: filters.limit ?? PAGE_LIMIT,
    cursor: filters.cursor,
    businessUnitId: filters.businessUnitId,
    username: filters.search,
    email: filters.email,
    role,
  })
  return {
    data: page.data.filter((u) => ctx.manageableRoles.includes(u.role)),
    // Keep the envelope self-consistent: an upstream page claiming `hasMore`
    // without a cursor would otherwise render a Load more button that cannot
    // do anything, since the hook has nothing to send.
    meta: {
      ...page.meta,
      hasMore: page.meta.hasMore && Boolean(page.meta.nextCursor),
    },
  }
}

/**
 * Customer listing — `GET /users?role=CUSTOMER`, ADMIN only.
 *
 * Customers hold no business-unit links, so this is only reachable by an
 * actor with no unit scoping. A MANAGER is pinned to their claim by the
 * backend and would always get an empty page, so we return one directly
 * rather than burning a round-trip on a guaranteed-empty answer. No
 * `businessUnitId` is ever forwarded: AND-combining it would collapse the
 * result to empty (docs §1.3).
 */
export async function listCustomers(
  ctx: AdminContext,
  filters: Pick<
    InternalUserFilters,
    'search' | 'email' | 'limit' | 'cursor'
  > = {},
): Promise<Paginated<User>> {
  const limit = filters.limit ?? PAGE_LIMIT
  if (ctx.role !== 'ADMIN') {
    return { data: [], meta: { limit, nextCursor: null, hasMore: false } }
  }
  if (USE_MOCKS) {
    return listCustomersMock({ ...filters, limit })
  }
  return fetchUsersPage({
    limit,
    cursor: filters.cursor,
    username: filters.search,
    email: filters.email,
    role: 'CUSTOMER',
  })
}

/**
 * [stub-ish] the backend has no `GET /users/:id`; in live mode this walks the
 * paginated listing looking for the id (bounded to a few pages).
 */
export async function getInternalUser(
  ctx: AdminContext,
  id: string,
): Promise<User | null> {
  if (USE_MOCKS) {
    return getInternalUserMock(
      id,
      ctx.scopedBusinessUnitIds,
      ctx.manageableRoles,
    )
  }
  let cursor: string | undefined
  for (let i = 0; i < 5; i++) {
    const page = await fetchUsersPage({ limit: SCAN_LIMIT, cursor })
    const found = page.data.find((u) => u.id === id)
    if (found) {
      return ctx.manageableRoles.includes(found.role) ? found : null
    }
    if (!page.meta.hasMore || !page.meta.nextCursor) break
    cursor = page.meta.nextCursor
  }
  return null
}

export async function createInternalUser(
  ctx: AdminContext,
  input: CreateInternalUserInput,
): Promise<User> {
  // MANAGER cannot create users for units outside their own scope.
  // ADMIN role users carry no unit binding.
  const businessUnitIds =
    input.role === 'ADMIN'
      ? []
      : ctx.role === 'MANAGER' && ctx.scopedBusinessUnitIds?.length
        ? input.businessUnitIds.filter((id) =>
            ctx.scopedBusinessUnitIds!.includes(id),
          )
        : input.businessUnitIds

  if (USE_MOCKS) {
    return createInternalUserMock(
      { ...input, businessUnitIds },
      ctx.manageableRoles,
    )
  }
  return serverFetch<User>('/users', {
    method: 'POST',
    body: {
      name: input.name,
      username: input.username,
      password: input.password,
      role: input.role,
      email: input.email || undefined,
      phone: input.phone || undefined,
      businessUnitIds: businessUnitIds.length ? businessUnitIds : undefined,
    },
  })
}

export async function updateInternalUser(
  ctx: AdminContext,
  id: string,
  patch: UpdateInternalUserInput,
): Promise<User | null> {
  // MANAGER cannot move a user to a different unit. Refusing outright beats
  // silently discarding the field: dropping it left the request looking like an
  // empty unit set, so the actor was told to assign a unit while staring at the
  // units they had just ticked.
  if (ctx.role === 'MANAGER' && patch.businessUnitIds !== undefined) {
    throw Object.assign(
      new Error('Only an administrator can change unit assignments.'),
      { code: 'unit_change_forbidden' },
    )
  }
  const safePatch: UpdateInternalUserInput =
    ctx.role === 'MANAGER' ? { ...patch, businessUnitIds: undefined } : patch
  // Promoting to ADMIN drops the unit bindings on the target.
  if (safePatch.role === 'ADMIN') safePatch.businessUnitIds = []

  if (USE_MOCKS) {
    return updateInternalUserMock(
      id,
      safePatch,
      ctx.scopedBusinessUnitIds,
      ctx.manageableRoles,
    )
  }
  // [stub] the backend only supports replacing the unit set
  // (`PUT /users/:id/business-units`, ADMIN, non-empty). Profile fields
  // (name/email/phone/role) have no update endpoint yet.
  //
  // These carry a `code` rather than a status, so the route can dispatch them
  // through the same ladder as `email_taken`/`role_forbidden` instead of
  // sniffing `err.status` — which could not tell our own refusal apart from a
  // genuine upstream error of the same status.
  const wantsProfileEdit =
    safePatch.name !== undefined ||
    safePatch.email !== undefined ||
    safePatch.phone !== undefined ||
    safePatch.role !== undefined
  if (wantsProfileEdit) {
    throw Object.assign(
      new Error('Editing staff profile fields is not supported yet.'),
      { code: 'profile_edit_unsupported' },
    )
  }
  if (!safePatch.businessUnitIds || safePatch.businessUnitIds.length === 0) {
    throw Object.assign(
      new Error('A staff user must be bound to at least one unit.'),
      { code: 'unit_required' },
    )
  }
  try {
    return await serverFetch<User>(`/users/${id}/business-units`, {
      method: 'PUT',
      body: { businessUnitIds: safePatch.businessUnitIds },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function setInternalUserActive(
  ctx: AdminContext,
  id: string,
  isActive: boolean,
): Promise<User | null> {
  if (USE_MOCKS) {
    return setInternalUserActiveMock(
      id,
      isActive,
      ctx.scopedBusinessUnitIds,
      ctx.manageableRoles,
    )
  }
  try {
    return await serverFetch<User>(
      `/users/${id}/${isActive ? 'reactivate' : 'deactivate'}`,
      { method: 'PATCH' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export type {
  CreateInternalUserInput,
  UpdateInternalUserInput,
} from './mocks/admin-users'
