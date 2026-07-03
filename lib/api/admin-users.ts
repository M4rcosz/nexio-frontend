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
import type { Paginated, Role, User } from './types'
import type { AdminContext } from '@/lib/auth/access'
import {
  type CreateInternalUserInput,
  type InternalUserFilters,
  type UpdateInternalUserInput,
  createInternalUserMock,
  getInternalUserMock,
  listInternalUsersMock,
  setInternalUserActiveMock,
  updateInternalUserMock,
} from './mocks/admin-users'

const PAGE_LIMIT = 100

async function fetchUsersPage(query: {
  limit?: number
  cursor?: string
  businessUnitId?: string
  username?: string
  email?: string
}): Promise<Paginated<User>> {
  return serverFetch<Paginated<User>>('/users', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      businessUnitId: query.businessUnitId,
      username: query.username,
      email: query.email,
    },
    cache: 'no-store',
  })
}

export async function listInternalUsers(
  ctx: AdminContext,
  filters: Omit<InternalUserFilters, 'scopedBusinessUnitIds' | 'allowedRoles'> = {},
): Promise<User[]> {
  if (USE_MOCKS) {
    return listInternalUsersMock({
      ...filters,
      scopedBusinessUnitIds: ctx.scopedBusinessUnitIds,
      allowedRoles: ctx.manageableRoles,
    })
  }
  // The backend filters by unit/username/email and already scopes MANAGERs to
  // their own units; role filtering is applied client-side (no query param).
  const page = await fetchUsersPage({
    limit: PAGE_LIMIT,
    businessUnitId: filters.businessUnitId,
    username: filters.search,
  })
  let users = page.data.filter((u) => ctx.manageableRoles.includes(u.role))
  if (filters.role) users = users.filter((u) => u.role === filters.role)
  return users
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
    return getInternalUserMock(id, ctx.scopedBusinessUnitIds, ctx.manageableRoles)
  }
  let cursor: string | undefined
  for (let i = 0; i < 5; i++) {
    const page = await fetchUsersPage({ limit: PAGE_LIMIT, cursor })
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
  // MANAGER cannot move a user to a different unit.
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
  const wantsProfileEdit =
    safePatch.name !== undefined ||
    safePatch.email !== undefined ||
    safePatch.phone !== undefined ||
    safePatch.role !== undefined
  if (wantsProfileEdit) {
    throw new ApiError(
      501,
      null,
      'Editing staff profile fields is not supported by the backend yet.',
    )
  }
  if (!safePatch.businessUnitIds || safePatch.businessUnitIds.length === 0) {
    throw new ApiError(
      422,
      null,
      'The business unit set cannot be empty — deactivate the user instead.',
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
