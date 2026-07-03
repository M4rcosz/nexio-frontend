import { serverFetch, USE_MOCKS } from './client'
import type { ChangeMyPasswordRequest, UpdateMeRequest, User } from './types'
import { getMeMock, updateMeMock } from './mocks/users'
import { getSession } from '@/lib/auth/session'
import { ApiError } from './errors'
import { mockDelay } from './mocks/_delay'

// [stub] the backend does not expose a `GET /users/me` — the profile shown in
// the UI is reconstructed from the JWT claims + mock store.
export async function getMe(): Promise<User> {
  const session = await getSession()
  return getMeMock(session?.sub ?? null)
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
