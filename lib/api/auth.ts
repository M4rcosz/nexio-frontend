import { serverFetchAnonymous, USE_MOCKS } from './client'
import type { LoginRequest, LoginResponse, RegisterRequest, Role } from './types'
import { mockDelay } from './mocks/_delay'
import { findUserByUsernameMock } from './mocks/admin-users'
import { ApiError } from './errors'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.mock-signature`
}

/**
 * Pick a role and stable subject id from the typed username so testers can
 * sign in as any role without us touching the backend. Falls back to
 * CUSTOMER for anything we don't recognize.
 */
function deriveMockUserFromUsername(username: string): {
  sub: string
  role: Role
} {
  // 1. Real seeded user wins
  const seeded = findUserByUsernameMock(username)
  if (seeded) return { sub: seeded.id, role: seeded.role }

  // 2. Fallback heuristic on the username prefix
  const lower = username.toLowerCase()
  if (lower.startsWith('admin')) return { sub: 'usr_admin_demo', role: 'ADMIN' }
  if (lower.startsWith('manager')) return { sub: 'usr_manager_recife', role: 'MANAGER' }
  if (lower.startsWith('attendant')) return { sub: 'usr_attendant_maria', role: 'ATTENDANT' }
  if (lower.startsWith('kitchen')) return { sub: 'usr_kitchen_jose', role: 'KITCHEN' }
  return { sub: 'usr_customer_demo', role: 'CUSTOMER' }
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
    const { sub, role } = deriveMockUserFromUsername(body.username)
    const token = fakeJwt({
      sub,
      username: body.username,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 30,
    })
    return { access_token: token }
  }
  return serverFetchAnonymous<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
  })
}

/**
 * [stub] The backend does not implement signup yet. The Route Handler treats
 * this as "pretend it persisted" and returns a mock access_token so the user
 * is auto-signed in.
 */
export async function registerStub(
  body: RegisterRequest,
): Promise<LoginResponse> {
  await mockDelay()
  if (!body.username || body.password.length < 8) {
    throw new Error('Invalid signup payload.')
  }
  return loginBackend({ username: body.username, password: body.password })
}
