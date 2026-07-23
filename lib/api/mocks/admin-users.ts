// Mock fallback for the `/users` staff-management endpoints (used when
// NEXT_PUBLIC_USE_MOCKS=true or the backend is unavailable).
//
// Single in-memory store of every user, staff and customer alike. Shared
// between `getMe` lookup and the admin management endpoints so a user created
// from the admin UI is immediately resolvable as a JWT subject. Customers live
// here too — they are only kept out of the staff listings by `allowedRoles`,
// since CUSTOMER is in no actor's `manageableRoles`.
import type { Paginated, Role, User } from '@/lib/api/types'
import { cursorStart, encodeMockCursor } from './_cursor'
import { MOCK_BUSINESS_UNITS } from './business-units'
import { mockDelay } from './_delay'

function makeUser(
  id: string,
  username: string,
  name: string,
  role: Role,
  businessUnitIds: string[],
  email = `${username}@nexio.com`,
  phone: string | null = '(81) 99999-0000',
): User {
  return {
    id,
    username,
    email,
    name,
    phone,
    role,
    businessUnitIds,
    isActive: true,
  }
}

/** Internal store — mutated by admin CRUD. Seeded with realistic data. */
const STORE: User[] = [
  // Top-level (ADMIN carries no unit binding)
  makeUser(
    'usr_admin_demo',
    'admin',
    'Administradora Geral',
    'ADMIN',
    [],
    'admin@nexio.com',
  ),

  // Managers (one per unit)
  makeUser(
    'usr_manager_recife',
    'manager.recife',
    'Beatriz Lima',
    'MANAGER',
    [MOCK_BUSINESS_UNITS[0].id],
    'beatriz@nexio.com',
  ),
  makeUser(
    'usr_manager_olinda',
    'manager.olinda',
    'Rafael Souza',
    'MANAGER',
    [MOCK_BUSINESS_UNITS[1].id],
    'rafael@nexio.com',
  ),

  // Attendants
  makeUser(
    'usr_attendant_maria',
    'maria.atendente',
    'Maria Silva',
    'ATTENDANT',
    [MOCK_BUSINESS_UNITS[0].id],
    'maria@nexio.com',
  ),
  makeUser(
    'usr_attendant_pedro',
    'pedro.atendente',
    'Pedro Henrique',
    'ATTENDANT',
    [MOCK_BUSINESS_UNITS[0].id],
    'pedro@nexio.com',
  ),
  makeUser(
    'usr_attendant_ana',
    'ana.atendente',
    'Ana Costa',
    'ATTENDANT',
    [MOCK_BUSINESS_UNITS[1].id],
    'ana@nexio.com',
  ),

  // Kitchen
  makeUser(
    'usr_kitchen_jose',
    'jose.cozinha',
    'José Cozinha',
    'KITCHEN',
    [MOCK_BUSINESS_UNITS[0].id],
    'jose@nexio.com',
  ),
  makeUser(
    'usr_kitchen_lucia',
    'lucia.cozinha',
    'Lúcia Mendes',
    'KITCHEN',
    [MOCK_BUSINESS_UNITS[1].id],
    'lucia@nexio.com',
  ),

  // Customers. They carry no unit binding at all, which is exactly why they
  // were unreachable before `?role=CUSTOMER` existed. Kept in this same store
  // so `findUserBySubMock` can resolve a customer JWT subject; the staff
  // listings never surface them because CUSTOMER is in nobody's
  // `manageableRoles`.
  makeUser(
    'usr_customer_demo',
    'demo.customer',
    'Demo Customer',
    'CUSTOMER',
    [],
    'demo.customer@nexio.com',
  ),
  makeUser(
    'usr_customer_nexio',
    'nexio.customer',
    'Nexio Customer',
    'CUSTOMER',
    [],
    'nexio.customer@nexio.com',
  ),
  makeUser(
    'usr_customer_carla',
    'carla.oliveira',
    'Carla Oliveira',
    'CUSTOMER',
    [],
    'carla.oliveira@gmail.com',
    '(81) 98888-1122',
  ),
  makeUser(
    'usr_customer_tiago',
    'tiago.ramos',
    'Tiago Ramos',
    'CUSTOMER',
    [],
    'tiago.ramos@gmail.com',
    '(81) 97777-3344',
  ),
  makeUser(
    'usr_customer_helena',
    'helena.barros',
    'Helena Barros',
    'CUSTOMER',
    [],
    'helena.barros@outlook.com',
    null,
  ),
]

function newId(prefix = 'usr'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function inScope(user: User, scopedBusinessUnitIds?: string[] | null): boolean {
  if (!scopedBusinessUnitIds) return true
  return user.businessUnitIds.some((id) => scopedBusinessUnitIds.includes(id))
}

export type InternalUserFilters = {
  role?: Role
  businessUnitId?: string
  search?: string
  email?: string
  limit?: number
  cursor?: string
  /** When set, scopes the listing to these units (used for MANAGER). */
  scopedBusinessUnitIds?: string[] | null
  /** Restrict listing to these roles (the actor's manageable roles). */
  allowedRoles?: Role[]
}

const DEFAULT_ALLOWED: Role[] = ['ATTENDANT', 'KITCHEN']

export const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

/**
 * Slices an already-filtered list into the backend's cursor envelope, using
 * the same opaque keyset token the live API issues (see `_cursor.ts`).
 */
function paginate<T extends { id: string }>(
  rows: T[],
  limit = DEFAULT_PAGE_LIMIT,
  cursor?: string,
): Paginated<T> {
  const size = Math.min(
    Math.max(Math.trunc(limit) || DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  )
  const start = cursorStart(rows, cursor)
  const slice = rows.slice(start, start + size)
  const last = slice[slice.length - 1]
  const hasMore = start + slice.length < rows.length
  return {
    data: slice.map((r) => ({ ...r })),
    meta: {
      limit: size,
      nextCursor: hasMore && last ? encodeMockCursor(last.id) : null,
      hasMore,
    },
  }
}

/**
 * NOTE: this applies `allowedRoles` *before* paginating, whereas the live path
 * post-filters what the backend already paginated (`listInternalUsers`). The
 * mock therefore always returns full pages and structurally cannot reproduce
 * the empty-page-with-hasMore condition that only appears against the real
 * backend. Keep that in mind when relying on mock-mode QA for this listing.
 */
export async function listInternalUsersMock(
  filters: InternalUserFilters = {},
): Promise<Paginated<User>> {
  await mockDelay()
  const allowed = filters.allowedRoles ?? DEFAULT_ALLOWED
  let users = STORE.filter((u) => allowed.includes(u.role))

  if (filters.scopedBusinessUnitIds) {
    users = users.filter((u) => inScope(u, filters.scopedBusinessUnitIds))
  }
  if (filters.role) users = users.filter((u) => u.role === filters.role)
  if (filters.businessUnitId)
    users = users.filter((u) =>
      u.businessUnitIds.includes(filters.businessUnitId!),
    )
  if (filters.search) {
    const term = filters.search.toLowerCase()
    users = users.filter((u) => u.username.toLowerCase().includes(term))
  }
  if (filters.email) {
    const term = filters.email.toLowerCase()
    users = users.filter((u) => (u.email ?? '').toLowerCase().includes(term))
  }
  return paginate(users, filters.limit, filters.cursor)
}

/**
 * `GET /users?role=CUSTOMER`. Deliberately ignores `businessUnitId`: the real
 * endpoint AND-combines it, and since customers hold no unit links any unit
 * filter collapses the page to empty. Callers are ADMIN-only (§1.3).
 */
export async function listCustomersMock(
  filters: Pick<
    InternalUserFilters,
    'search' | 'email' | 'limit' | 'cursor'
  > = {},
): Promise<Paginated<User>> {
  await mockDelay()
  let users = STORE.filter((u) => u.role === 'CUSTOMER')
  if (filters.search) {
    const term = filters.search.toLowerCase()
    users = users.filter((u) => u.username.toLowerCase().includes(term))
  }
  if (filters.email) {
    const term = filters.email.toLowerCase()
    users = users.filter((u) => (u.email ?? '').toLowerCase().includes(term))
  }
  return paginate(users, filters.limit, filters.cursor)
}

export async function getInternalUserMock(
  id: string,
  scopedBusinessUnitIds?: string[] | null,
  allowedRoles: Role[] = DEFAULT_ALLOWED,
): Promise<User | null> {
  await mockDelay()
  const u = STORE.find((x) => x.id === id)
  if (!u) return null
  if (!allowedRoles.includes(u.role)) return null
  if (!inScope(u, scopedBusinessUnitIds)) return null
  return { ...u }
}

export type CreateInternalUserInput = {
  username: string
  email: string
  name: string
  phone?: string
  password: string
  role: Role
  /** ADMIN users carry no unit; everyone else needs at least one. */
  businessUnitIds: string[]
}

export async function createInternalUserMock(
  input: CreateInternalUserInput,
  allowedRoles: Role[] = DEFAULT_ALLOWED,
): Promise<User> {
  await mockDelay()
  if (!allowedRoles.includes(input.role)) {
    throw Object.assign(new Error('Role not allowed for this actor.'), {
      code: 'role_forbidden',
    })
  }
  // Uniqueness checks
  if (
    STORE.some((u) => u.username.toLowerCase() === input.username.toLowerCase())
  ) {
    throw Object.assign(new Error('Username already taken.'), {
      code: 'username_taken',
    })
  }
  if (STORE.some((u) => u.email?.toLowerCase() === input.email.toLowerCase())) {
    throw Object.assign(new Error('E-mail already registered.'), {
      code: 'email_taken',
    })
  }
  // (password is intentionally not stored — this is a mock; the real backend
  // would hash with argon2)
  const user: User = {
    id: newId(),
    username: input.username,
    email: input.email,
    name: input.name,
    phone: input.phone ?? null,
    role: input.role,
    businessUnitIds: input.businessUnitIds,
    isActive: true,
  }
  // Newest first: the contract fixes ordering at `createdAt desc, id desc`
  // (§1.4). Appending would put a user created from the admin UI on the last
  // page instead of the top of the first.
  STORE.unshift(user)
  return { ...user }
}

export type UpdateInternalUserInput = {
  email?: string
  name?: string
  phone?: string | null
  role?: Role
  businessUnitIds?: string[]
}

export async function updateInternalUserMock(
  id: string,
  patch: UpdateInternalUserInput,
  scopedBusinessUnitIds?: string[] | null,
  allowedRoles: Role[] = DEFAULT_ALLOWED,
): Promise<User | null> {
  await mockDelay()
  const idx = STORE.findIndex((x) => x.id === id)
  if (idx < 0) return null
  if (!allowedRoles.includes(STORE[idx].role)) return null
  if (!inScope(STORE[idx], scopedBusinessUnitIds)) return null
  if (patch.role && !allowedRoles.includes(patch.role)) {
    throw Object.assign(new Error('Role not allowed for this actor.'), {
      code: 'role_forbidden',
    })
  }
  if (
    patch.email &&
    STORE.some(
      (u) =>
        u.id !== id && u.email?.toLowerCase() === patch.email!.toLowerCase(),
    )
  ) {
    throw Object.assign(new Error('E-mail already registered.'), {
      code: 'email_taken',
    })
  }
  STORE[idx] = {
    ...STORE[idx],
    ...patch,
    businessUnitIds: patch.businessUnitIds ?? STORE[idx].businessUnitIds,
  }
  return { ...STORE[idx] }
}

export async function setInternalUserActiveMock(
  id: string,
  isActive: boolean,
  scopedBusinessUnitIds?: string[] | null,
  allowedRoles: Role[] = DEFAULT_ALLOWED,
): Promise<User | null> {
  await mockDelay()
  const idx = STORE.findIndex((x) => x.id === id)
  if (idx < 0) return null
  if (!allowedRoles.includes(STORE[idx].role)) return null
  if (!inScope(STORE[idx], scopedBusinessUnitIds)) return null
  STORE[idx] = { ...STORE[idx], isActive }
  return { ...STORE[idx] }
}

/** Lookup by JWT subject — used by getMe and the smart mock login. */
export function findUserBySubMock(sub: string): User | null {
  return STORE.find((u) => u.id === sub) ?? null
}

export function findUserByUsernameMock(username: string): User | null {
  return (
    STORE.find((u) => u.username.toLowerCase() === username.toLowerCase()) ??
    null
  )
}
