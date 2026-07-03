import { serverFetchAnonymous, USE_MOCKS } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  Role,
  User,
} from './types'
import { mockDelay } from './mocks/_delay'
import { findUserByUsernameMock } from './mocks/admin-users'
import { ApiError } from './errors'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.mock-signature`
}

function fakeRefreshToken(): string {
  return `mockrt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Pick a role and stable subject id from the typed username so testers can
 * sign in as any role without us touching the backend. Falls back to
 * CUSTOMER for anything we don't recognize.
 */
function deriveMockUserFromUsername(username: string): {
  sub: string
  role: Role
  businessUnitIds: string[]
} {
  // 1. Real seeded user wins
  const seeded = findUserByUsernameMock(username)
  if (seeded) {
    return { sub: seeded.id, role: seeded.role, businessUnitIds: seeded.businessUnitIds }
  }

  // 2. Fallback heuristic on the username prefix
  const lower = username.toLowerCase()
  if (lower.startsWith('admin')) {
    return { sub: 'usr_admin_demo', role: 'ADMIN', businessUnitIds: [] }
  }
  if (lower.startsWith('manager')) {
    return {
      sub: 'usr_manager_recife',
      role: 'MANAGER',
      businessUnitIds: ['bu_recife_boavista'],
    }
  }
  if (lower.startsWith('attendant')) {
    return {
      sub: 'usr_attendant_maria',
      role: 'ATTENDANT',
      businessUnitIds: ['bu_recife_boavista'],
    }
  }
  if (lower.startsWith('kitchen')) {
    return {
      sub: 'usr_kitchen_jose',
      role: 'KITCHEN',
      businessUnitIds: ['bu_recife_boavista'],
    }
  }
  return { sub: 'usr_customer_demo', role: 'CUSTOMER', businessUnitIds: [] }
}

export async function loginBackend(
  body: LoginRequest,
): Promise<LoginResponse> {
  if (USE_MOCKS) {
    await mockDelay()
    if (!body.password || body.password.length < 1) {
      throw new ApiError(401, null, 'Invalid credentials.')
    }
    // Demo convenience: any password of 8+ chars is accepted. Shorter ones
    // simulate a failed login so the wrong-credentials UI can be tested.
    if (body.password.length < 4) {
      throw new ApiError(401, null, 'Invalid credentials.')
    }
    const { sub, role, businessUnitIds } = deriveMockUserFromUsername(body.username)
    const token = fakeJwt({
      sub,
      username: body.username,
      role,
      businessUnitIds,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 30,
    })
    return { access_token: token, refresh_token: fakeRefreshToken() }
  }
  return serverFetchAnonymous<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
  })
}

/**
 * Exchange a refresh token for a new token pair (`POST /auth/refresh`).
 * The backend rotates the refresh token — always persist the returned one.
 */
export async function refreshBackend(
  refreshToken: string,
): Promise<LoginResponse> {
  if (USE_MOCKS) {
    await mockDelay()
    if (!refreshToken.startsWith('mockrt_')) {
      throw new ApiError(401, null, 'Invalid refresh token.')
    }
    // The mock cannot recover the original user from an opaque token, so it
    // re-issues a customer session (enough to exercise the refresh flow).
    const token = fakeJwt({
      sub: 'usr_customer_demo',
      username: 'demo.customer',
      role: 'CUSTOMER',
      businessUnitIds: [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 30,
    })
    return { access_token: token, refresh_token: fakeRefreshToken() }
  }
  return serverFetchAnonymous<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

/** Revoke a refresh token (`POST /auth/logout`, answers 204). */
export async function logoutBackend(refreshToken: string): Promise<void> {
  if (USE_MOCKS) {
    await mockDelay()
    return
  }
  await serverFetchAnonymous<void>('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

/**
 * Self-register a customer against `POST /users/register`. The backend forces
 * the CUSTOMER role server-side and returns the created user (no token), so the
 * caller is expected to sign in afterwards to obtain a session.
 */
export async function registerCustomer(
  body: RegisterRequest,
): Promise<User> {
  if (USE_MOCKS) {
    await mockDelay()
    if (body.username.length < 3 || body.password.length < 8) {
      throw new ApiError(400, null, 'Invalid signup payload.')
    }
    if (findUserByUsernameMock(body.username)) {
      throw new ApiError(409, null, 'Username already in use.')
    }
    return {
      id: `usr_${body.username}`,
      username: body.username,
      email: body.email ?? null,
      name: body.name,
      phone: body.phone ?? null,
      role: 'CUSTOMER',
      businessUnitIds: [],
      isActive: true,
    }
  }
  return serverFetchAnonymous<User>('/users/register', {
    method: 'POST',
    body,
  })
}
