import type { Role } from '@/lib/api/types'
import { getMe } from '@/lib/api/users'
import { getSession } from './session'

export type AdminRole = 'ADMIN' | 'MANAGER'

export type AdminContext = {
  userId: string
  role: AdminRole
  /**
   * The business unit the user is scoped to. ADMIN has no scoping (null,
   * meaning "all units"). MANAGER is always scoped to their own unit.
   */
  scopedBusinessUnitId: string | null
  /**
   * Roles this actor is allowed to create, list and edit. Driven by the
   * organisational hierarchy:
   *   - ADMIN   → ADMIN, MANAGER, ATTENDANT, KITCHEN
   *   - MANAGER → ATTENDANT, KITCHEN
   */
  manageableRoles: Role[]
}

const ADMIN_ROLES: Role[] = ['ADMIN', 'MANAGER']

const MANAGEABLE_BY_ROLE: Record<AdminRole, Role[]> = {
  ADMIN: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
  MANAGER: ['ATTENDANT', 'KITCHEN'],
}

export function getManageableRoles(actor: AdminRole): Role[] {
  return MANAGEABLE_BY_ROLE[actor]
}

export function canManageRole(actor: AdminRole, target: Role): boolean {
  return MANAGEABLE_BY_ROLE[actor].includes(target)
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getSession()
  if (!session) return null
  const role = session.role as Role
  if (!ADMIN_ROLES.includes(role)) return null

  let scoped: string | null = null
  if (role === 'MANAGER') {
    const me = await getMe()
    scoped = me.businessUnitId
  }

  return {
    userId: session.sub,
    role: role as AdminRole,
    scopedBusinessUnitId: scoped,
    manageableRoles: MANAGEABLE_BY_ROLE[role as AdminRole],
  }
}

export async function hasAdminAccess(): Promise<boolean> {
  return (await getAdminContext()) !== null
}
