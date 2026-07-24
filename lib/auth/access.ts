import type { Role } from '@/lib/api/types'
import { getSession } from './session'

export type AdminRole = 'ADMIN' | 'MANAGER'

/**
 * Admin ("ERP") sections, and what each role may do in them.
 *
 * ATTENDANT was added to the admin context deliberately narrowly: they ring up
 * orders, and they need to *see* stock and menu state to answer a customer at
 * the counter — but nothing more. Everything absent from a role's map is
 * inaccessible, so this is allow-list, not deny-list: a new section is hidden
 * from ATTENDANT until someone opts it in here.
 *
 * `read` means the section renders without its mutating affordances. It is a UI
 * concern only — never the sole guard. Every mutating route handler must still
 * enforce its own role check, since hiding a button stops nobody.
 */
export type SectionAccess = 'full' | 'read'

/** Roles that may open the ERP shell at all. Superset of {@link AdminRole}. */
export type ErpRole = AdminRole | 'ATTENDANT'

export type AdminSection =
  | 'overview'
  | 'orders'
  | 'users'
  | 'customers'
  | 'products'
  | 'categories'
  | 'menu'
  | 'businessUnits'
  | 'inventory'
  | 'promotions'
  | 'ai'

const SECTIONS_BY_ROLE: Record<
  ErpRole,
  Partial<Record<AdminSection, SectionAccess>>
> = {
  ADMIN: {
    overview: 'full',
    orders: 'full',
    users: 'full',
    customers: 'full',
    products: 'full',
    categories: 'full',
    menu: 'full',
    businessUnits: 'full',
    inventory: 'full',
    promotions: 'full',
    ai: 'full',
  },
  MANAGER: {
    overview: 'full',
    orders: 'full',
    users: 'full',
    products: 'full',
    menu: 'full',
    inventory: 'full',
    promotions: 'full',
  },
  // Orders (they place and progress them), plus read-only inventory and menu
  // so they can answer "do you still have this?" without being able to change
  // stock or the catalogue. No users, no customers, no business units.
  ATTENDANT: {
    orders: 'full',
    inventory: 'read',
    menu: 'read',
  },
}

export function sectionAccess(
  role: ErpRole,
  section: AdminSection,
): SectionAccess | null {
  return SECTIONS_BY_ROLE[role][section] ?? null
}

/** Whether the role may open the section at all (read or full). */
export function canViewSection(role: ErpRole, section: AdminSection): boolean {
  return sectionAccess(role, section) !== null
}

/** Whether the role may mutate within the section. */
export function canEditSection(role: ErpRole, section: AdminSection): boolean {
  return sectionAccess(role, section) === 'full'
}

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
  const scopedIds = role === 'ADMIN' ? null : (session.businessUnitIds ?? [])

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

export type ErpContext = {
  userId: string
  role: ErpRole
  scopedBusinessUnitIds: string[] | null
  scopedBusinessUnitId: string | null
}

const ERP_ROLES: Role[] = ['ADMIN', 'MANAGER', 'ATTENDANT']

/**
 * Context for the ERP shell, which ATTENDANT may enter (orders, plus read-only
 * inventory and menu) while {@link AdminRole} stays ADMIN|MANAGER.
 *
 * These are deliberately two functions rather than one widened role union.
 * `getAdminContext()` is the authorization gate for ~50 call sites, most of
 * which check only that it returned non-null; adding ATTENDANT to `AdminRole`
 * silently granted attendants every one of them, including `PATCH
 * /api/admin/users/:id`, user deactivation, inventory adjustment, menu
 * mutation and all promotion routes. Keeping the admin gate narrow means
 * attendant access is *additive* — a surface has to opt in by calling this
 * function, so anything untouched stays default-deny.
 *
 * Callers must still pair this with {@link canViewSection} /
 * {@link canEditSection}: this only says "may enter the ERP", never "may do
 * this particular thing".
 */
export async function getErpContext(): Promise<ErpContext | null> {
  const session = await getSession()
  if (!session) return null
  const role = session.role as Role
  if (!ERP_ROLES.includes(role)) return null

  const scopedIds = role === 'ADMIN' ? null : (session.businessUnitIds ?? [])

  return {
    userId: session.sub,
    role: role as ErpRole,
    scopedBusinessUnitIds: scopedIds,
    scopedBusinessUnitId: scopedIds?.[0] ?? null,
  }
}
