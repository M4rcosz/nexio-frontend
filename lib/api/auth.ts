import { serverFetchAnonymous, USE_MOCKS } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
} from './types'

// The mock implementations live in ./mocks/auth-mock and are imported lazily
// only when USE_MOCKS is on, so this module — pulled into the edge middleware
// bundle via refreshBackend — never statically bundles Buffer or seed data.

export async function loginBackend(body: LoginRequest): Promise<LoginResponse> {
  if (USE_MOCKS) {
    const { mockLogin } = await import('./mocks/auth-mock')
    return mockLogin(body)
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
    const { mockRefresh } = await import('./mocks/auth-mock')
    return mockRefresh(refreshToken)
  }
  return serverFetchAnonymous<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

/** Revoke a refresh token (`POST /auth/logout`, answers 204). */
export async function logoutBackend(refreshToken: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockLogout } = await import('./mocks/auth-mock')
    return mockLogout()
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
export async function registerCustomer(body: RegisterRequest): Promise<User> {
  if (USE_MOCKS) {
    const { mockRegister } = await import('./mocks/auth-mock')
    return mockRegister(body)
  }
  return serverFetchAnonymous<User>('/users/register', {
    method: 'POST',
    body,
  })
}
