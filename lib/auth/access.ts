import type { Role } from '@/lib/api/types'
import { getSession } from './session'

export type AdminRole = 'ADMIN' | 'MANAGER'

export type AdminContext = {
  userId: string
  role: AdminRole
  /**
   * Units the actor may manage, straight from the JWT `businessUnitIds`
   * claim. `null` means unscoped (ADMIN — all units). An empty array means a
   * staff user with no unit bound (the backend answers 404 for unit-scoped
   * routes in that case).
   */
  scopedBusinessUnitIds: string[] | null
  /**
   * Convenience: first scoped unit, used as the default selection in admin
   * forms. `null` for ADMIN (no scoping).
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

/** Whether the actor may act on the given unit (ADMIN bypasses scoping). */
export function canAccessUnit(
  ctx: AdminContext,
  businessUnitId: string,
): boolean {
  if (ctx.scopedBusinessUnitIds === null) return true
  return ctx.scopedBusinessUnitIds.includes(businessUnitId)
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getSession()
  if (!session) return null
  const role = session.role as Role
  if (!ADMIN_ROLES.includes(role)) return null

  // Unit scoping comes from the JWT claim — no extra backend round-trip.
  const scopedIds =
    role === 'ADMIN' ? null : (session.businessUnitIds ?? [])

  return {
    userId: session.sub,
    role: role as AdminRole,
    scopedBusinessUnitIds: scopedIds,
    scopedBusinessUnitId: scopedIds?.[0] ?? null,
    manageableRoles: MANAGEABLE_BY_ROLE[role as AdminRole],
  }
}

export async function hasAdminAccess(): Promise<boolean> {
  return (await getAdminContext()) !== null
}
