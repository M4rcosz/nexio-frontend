// [stub] backend does not implement admin user management yet — always uses mock.
//
// All functions accept an `AdminContext` so MANAGER calls are automatically
// scoped to their own business unit and limited to the roles they may manage.
import type { User } from './types'
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

export async function listInternalUsers(
  ctx: AdminContext,
  filters: Omit<InternalUserFilters, 'scopedBusinessUnitId' | 'allowedRoles'> = {},
): Promise<User[]> {
  return listInternalUsersMock({
    ...filters,
    scopedBusinessUnitId: ctx.scopedBusinessUnitId,
    allowedRoles: ctx.manageableRoles,
  })
}

export async function getInternalUser(
  ctx: AdminContext,
  id: string,
): Promise<User | null> {
  return getInternalUserMock(id, ctx.scopedBusinessUnitId, ctx.manageableRoles)
}

export async function createInternalUser(
  ctx: AdminContext,
  input: CreateInternalUserInput,
): Promise<User> {
  // MANAGER cannot create users for a different unit — force their own.
  // ADMIN role gets `null` (no unit); everyone else needs a unit.
  const businessUnitId =
    ctx.role === 'MANAGER' && ctx.scopedBusinessUnitId
      ? ctx.scopedBusinessUnitId
      : input.role === 'ADMIN'
        ? null
        : input.businessUnitId
  return createInternalUserMock(
    { ...input, businessUnitId },
    ctx.manageableRoles,
  )
}

export async function updateInternalUser(
  ctx: AdminContext,
  id: string,
  patch: UpdateInternalUserInput,
): Promise<User | null> {
  // MANAGER cannot move a user to a different unit.
  const safePatch: UpdateInternalUserInput =
    ctx.role === 'MANAGER' ? { ...patch, businessUnitId: undefined } : patch
  // Promoting to ADMIN drops the business unit on the target.
  if (safePatch.role === 'ADMIN') safePatch.businessUnitId = null
  return updateInternalUserMock(
    id,
    safePatch,
    ctx.scopedBusinessUnitId,
    ctx.manageableRoles,
  )
}

export async function setInternalUserActive(
  ctx: AdminContext,
  id: string,
  isActive: boolean,
): Promise<User | null> {
  return setInternalUserActiveMock(
    id,
    isActive,
    ctx.scopedBusinessUnitId,
    ctx.manageableRoles,
  )
}

export type {
  CreateInternalUserInput,
  UpdateInternalUserInput,
} from './mocks/admin-users'
