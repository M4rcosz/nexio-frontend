// Client layer for the AI assistant contract (see docs/frontend-ai-memberships):
//   - GET   /ai/memberships/me            (any authenticated user)
//   - POST  /ai/memberships/:userId       (ADMIN — enroll)
//   - PATCH /ai/memberships/:userId/balance (ADMIN — top up / claw back)
//   - POST  /ai/chat                      (any enrolled user with tokens)
//
// The server is always authoritative; these helpers translate the documented
// status codes into ergonomic return shapes (404 → null) and leave the rest to
// the caller (route handlers) to map.
import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  AiMembership,
  ChatResponse,
  SendChatMessageRequest,
} from './types'
import {
  adjustAiMembershipBalanceMock,
  enrollAiMembershipMock,
  getMyAiMembershipMock,
  sendChatMessageMock,
} from './mocks/ai'
import { MOCK_CUSTOMER } from './mocks/users'
import { getSession } from '@/lib/auth/session'

/** Chat can run several bounded internal model round-trips server-side, so it
 * gets a much wider timeout than the default 4s backend budget. */
const CHAT_TIMEOUT_MS = 30_000

async function currentUserId(): Promise<string> {
  const session = await getSession()
  return session?.sub ?? MOCK_CUSTOMER.id
}

/**
 * `GET /ai/memberships/me`. `null` when the caller is not enrolled yet (the
 * backend answers 404) — render an empty "no AI access" state, not an error.
 */
export async function getMyAiMembership(): Promise<AiMembership | null> {
  if (USE_MOCKS) {
    return getMyAiMembershipMock(await currentUserId())
  }
  try {
    return await serverFetch<AiMembership>('/ai/memberships/me', {
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /ai/memberships/:userId` (ADMIN) — one-time grant. Propagates the
 * documented failures: 409 (already enrolled → switch to adjust) and 404 (no
 * such user).
 */
export async function enrollAiMembership(
  userId: string,
  initialBalance: number,
): Promise<AiMembership> {
  if (USE_MOCKS) {
    return enrollAiMembershipMock(userId, initialBalance)
  }
  return serverFetch<AiMembership>(`/ai/memberships/${userId}`, {
    method: 'POST',
    body: { initialBalance },
  })
}

/**
 * `PATCH /ai/memberships/:userId/balance` (ADMIN) — signed, non-zero delta.
 * `null` when the user is not enrolled (404 → enroll first). Throws
 * `ApiError(422)` when the change would go below zero or overflow the ceiling.
 */
export async function adjustAiMembershipBalance(
  userId: string,
  delta: number,
): Promise<AiMembership | null> {
  if (USE_MOCKS) {
    return adjustAiMembershipBalanceMock(userId, delta)
  }
  try {
    return await serverFetch<AiMembership>(
      `/ai/memberships/${userId}/balance`,
      { method: 'PATCH', body: { delta } },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /ai/chat` — one complete reply per request (no streaming). Propagates
 * the documented failures for the route handler to map: 403 (not enrolled or
 * out of tokens) and 503 (provider down — no tokens charged, safe to retry).
 */
export async function sendChatMessage(
  body: SendChatMessageRequest,
): Promise<ChatResponse> {
  if (USE_MOCKS) {
    return sendChatMessageMock(await currentUserId(), body)
  }
  return serverFetch<ChatResponse>('/ai/chat', {
    method: 'POST',
    body,
    timeoutMs: CHAT_TIMEOUT_MS,
  })
}
