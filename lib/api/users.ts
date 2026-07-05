import { serverFetch, USE_MOCKS } from './client'
import type { ChangeMyPasswordRequest, UpdateMeRequest, User } from './types'
import { getMeMock, updateMeMock } from './mocks/users'
import { getSession } from '@/lib/auth/session'
import { ApiError } from './errors'
import { mockDelay } from './mocks/_delay'

/**
 * `GET /users/me` — the authenticated user's profile. A 404 here means the
 * account no longer exists server-side (deleted/disabled): the {@link ApiError}
 * is propagated so callers can force a logout instead of showing a generic
 * "not found".
 */
// Explicit backend signals that the account itself was removed. A bare 404 is
// ambiguous (deleted account vs. missing route/gateway), so we only force a
// sign-out when one of these codes is present in the error body.
const ACCOUNT_GONE_CODES = new Set([
  'account_gone',
  'account_deleted',
  'user_deleted',
  'user_gone',
])

/**
 * True only when a `GET /users/me` failure carries an unambiguous
 * account-removed signal. Generic 404s (missing route, gateway) return false so
 * a still-valid user is not signed out by mistake.
 */
export function isAccountGoneError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 404) return false
  const body = err.body
  if (!body || typeof body !== 'object') return false
  const { code, error } = body as { code?: unknown; error?: unknown }
  const codeStr = typeof code === 'string' ? code.toLowerCase() : ''
  const errStr = typeof error === 'string' ? error.toLowerCase() : ''
  return ACCOUNT_GONE_CODES.has(codeStr) || ACCOUNT_GONE_CODES.has(errStr)
}

export async function getMe(): Promise<User> {
  if (USE_MOCKS) {
    const session = await getSession()
    return getMeMock(session?.sub ?? null)
  }
  return serverFetch<User>('/users/me', { cache: 'no-store' })
}

/**
 * `PATCH /users/me` (CUSTOMER) — updates own name and/or phone. At least one
 * field is required.
 */
export async function updateMe(body: UpdateMeRequest): Promise<User> {
  if (USE_MOCKS) {
    const session = await getSession()
    return updateMeMock(session?.sub ?? null, body)
  }
  return serverFetch<User>('/users/me', {
    method: 'PATCH',
    body,
  })
}

/**
 * `PATCH /users/me/password` — changes own password and revokes every
 * session server-side (the caller must sign in again).
 */
export async function changeMyPassword(
  body: ChangeMyPasswordRequest,
): Promise<void> {
  if (USE_MOCKS) {
    await mockDelay()
    if (body.newPassword === body.currentPassword) {
      throw new ApiError(422, null, 'New password must differ from the current one.')
    }
    if (body.newPassword.length < 10) {
      throw new ApiError(400, null, 'New password is too weak.')
    }
    return
  }
  await serverFetch<void>('/users/me/password', {
    method: 'PATCH',
    body,
  })
}
