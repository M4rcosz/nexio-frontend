// Mock fallback for the `/users` staff-management endpoints (used when
// NEXT_PUBLIC_USE_MOCKS=true or the backend is unavailable).
//
// Single in-memory store of internal users (anything other than CUSTOMER).
// Shared between `getMe` lookup and the admin management endpoints so a user
// created from the admin UI is immediately resolvable as a JWT subject.
import type { Role, User } from '@/lib/api/types'
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
  /** When set, scopes the listing to these units (used for MANAGER). */
  scopedBusinessUnitIds?: string[] | null
  /** Restrict listing to these roles (the actor's manageable roles). */
  allowedRoles?: Role[]
}

const DEFAULT_ALLOWED: Role[] = ['ATTENDANT', 'KITCHEN']

export async function listInternalUsersMock(
  filters: InternalUserFilters = {},
): Promise<User[]> {
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
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term),
    )
  }
  return users.map((u) => ({ ...u }))
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
  STORE.push(user)
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
