// Client layer for the AI assistant contract
// (see docs/frontend-api-reference.md#ai-assistant):
//   - GET    /ai/memberships/me                  (any authenticated user)
//   - POST   /ai/memberships/:userId             (ADMIN — enroll)
//   - PATCH  /ai/memberships/:userId/balance     (ADMIN — top up / claw back)
//   - DELETE /ai/memberships/:userId             (ADMIN — soft revoke)
//   - POST   /ai/memberships/:userId/reinstate   (ADMIN — undo a revoke)
//   - GET    /ai/memberships                     (ADMIN — usage report)
//   - POST   /ai/chat                            (any enrolled user with tokens)
//   - GET    /ai/conversations                   (self-scoped list)
//   - GET    /ai/conversations/:id               (self-scoped transcript)
//   - PATCH  /ai/conversations/:id               (self-scoped rename)
//   - DELETE /ai/conversations/:id               (self-scoped soft delete)
//
// The server is always authoritative; these helpers translate the documented
// status codes into ergonomic return shapes (404 → null) and leave the rest to
// the caller (route handlers) to map.
import { serverFetch, USE_MOCKS } from './client'
import { ApiError } from './errors'
import type {
  AiConversationDetail,
  AiConversationSummary,
  AiMembership,
  AiUsageReport,
  AiUsageReportQuery,
  ChatResponse,
  Paginated,
  SendChatMessageRequest,
} from './types'
import {
  adjustAiMembershipBalanceMock,
  deleteAiConversationMock,
  enrollAiMembershipMock,
  getAiConversationMock,
  getMyAiMembershipMock,
  listAiConversationsMock,
  listAiMembershipUsageMock,
  reinstateAiMembershipMock,
  renameAiConversationMock,
  revokeAiMembershipMock,
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

// --- Memberships ---

/**
 * `GET /ai/memberships/me`. `null` when the caller is not enrolled yet (the
 * backend answers 404) — render an empty "no AI access" state, not an error.
 * A revoked membership still resolves, with `revokedAt` set.
 */
export async function getMyAiMembership(): Promise<AiMembership | null> {
  if (USE_MOCKS) {
    return getMyAiMembershipMock(await currentUserId())
  }
  try {
    // Deliberately untagged and never cached: the response is scoped to the
    // caller's session but the URL is not, so any shared cache entry here
    // would serve one user's membership to another.
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
  return serverFetch<AiMembership>(
    `/ai/memberships/${encodeURIComponent(userId)}`,
    { method: 'POST', body: { initialBalance } },
  )
}

/**
 * `PATCH /ai/memberships/:userId/balance` (ADMIN) — signed, non-zero delta.
 * `null` when the user is not enrolled (404 → enroll first). Throws
 * `ApiError(403)` while the membership is revoked (reinstate first) and
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
      `/ai/memberships/${encodeURIComponent(userId)}/balance`,
      { method: 'PATCH', body: { delta } },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `DELETE /ai/memberships/:userId` (ADMIN) — soft revoke. The balance is
 * preserved; only access is blocked. Idempotent upstream, so a double-click is
 * harmless. `null` when the user is not enrolled (404).
 */
export async function revokeAiMembership(
  userId: string,
): Promise<AiMembership | null> {
  if (USE_MOCKS) {
    return revokeAiMembershipMock(userId)
  }
  try {
    return await serverFetch<AiMembership>(
      `/ai/memberships/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `POST /ai/memberships/:userId/reinstate` (ADMIN) — undo a revoke; balance and
 * everything else are restored. Idempotent. `null` when not enrolled (404).
 */
export async function reinstateAiMembership(
  userId: string,
): Promise<AiMembership | null> {
  if (USE_MOCKS) {
    return reinstateAiMembershipMock(userId)
  }
  try {
    return await serverFetch<AiMembership>(
      `/ai/memberships/${encodeURIComponent(userId)}/reinstate`,
      { method: 'POST' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `GET /ai/memberships` (ADMIN) — who holds a membership and what they burned
 * inside the window. Throws `ApiError(422)` when `from` is after `to` or the
 * cursor is malformed.
 *
 * The response carries **user emails** — it is the only AI endpoint that does.
 * Keep it out of any non-admin view and out of client-side logging.
 */
export async function listAiMembershipUsage(
  query: AiUsageReportQuery = {},
): Promise<AiUsageReport> {
  if (USE_MOCKS) {
    return listAiMembershipUsageMock(query)
  }
  return serverFetch<AiUsageReport>('/ai/memberships', {
    query: {
      from: query.from,
      to: query.to,
      limit: query.limit,
      cursor: query.cursor,
    },
    // Uncached, but tagged so the enroll/adjust/revoke/reinstate routes can
    // invalidate it explicitly — a report cached anywhere downstream must not
    // outlive the grant that changed it.
    next: { revalidate: 0, tags: ['ai-memberships'] },
  })
}

// --- Conversations ---

/**
 * `GET /ai/conversations` — the caller's threads, last activity first. Ordering
 * shifts as they chat, so re-fetch page one after sending rather than patching
 * the list in place.
 */
export async function listAiConversations(
  query: { limit?: number; cursor?: string; title?: string } = {},
): Promise<Paginated<AiConversationSummary>> {
  if (USE_MOCKS) {
    return listAiConversationsMock(await currentUserId(), query)
  }
  return serverFetch<Paginated<AiConversationSummary>>('/ai/conversations', {
    query: { limit: query.limit, cursor: query.cursor, title: query.title },
    cache: 'no-store',
  })
}

/**
 * `GET /ai/conversations/:id` — every stored turn, oldest first (uncapped, even
 * though only the last 40 are replayed to the model). `null` covers all three
 * upstream 404 cases — someone else's thread, deleted, or never existed — which
 * are indistinguishable on purpose. Never use it to probe whether an id exists.
 */
export async function getAiConversation(
  conversationId: string,
): Promise<AiConversationDetail | null> {
  if (USE_MOCKS) {
    return getAiConversationMock(await currentUserId(), conversationId)
  }
  try {
    return await serverFetch<AiConversationDetail>(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { cache: 'no-store' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `DELETE /ai/conversations/:id` — soft delete, and idempotent: re-deleting
 * returns the same row rather than a 404, so retries and double-clicks need no
 * guard. There is no undelete. Spend is **not** affected — it lives in a
 * separate per-user ledger, so this never changes the admin usage report.
 */
export async function deleteAiConversation(
  conversationId: string,
): Promise<AiConversationSummary | null> {
  if (USE_MOCKS) {
    return deleteAiConversationMock(await currentUserId(), conversationId)
  }
  try {
    return await serverFetch<AiConversationSummary>(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE', cache: 'no-store' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * `PATCH /ai/conversations/:id` — rename. Stores the (server-normalized) title
 * and does not reorder the list (`updatedAt` is untouched). `null` when the
 * thread is not the caller's live one (404 upstream). An invalid title is a
 * 422 and is left to propagate as `ApiError` for the route to map.
 */
export async function renameAiConversation(
  conversationId: string,
  title: string,
): Promise<AiConversationSummary | null> {
  if (USE_MOCKS) {
    return renameAiConversationMock(
      await currentUserId(),
      conversationId,
      title,
    )
  }
  try {
    return await serverFetch<AiConversationSummary>(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'PATCH', body: { title }, cache: 'no-store' },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// --- Chat ---

/**
 * `POST /ai/chat` — one complete reply per request (no streaming). Echo the
 * returned `conversationId` back on the next call or every message opens a new
 * single-turn thread. Propagates the documented failures for the route handler
 * to map: 403 (not enrolled, revoked or out of tokens), 404 (dead
 * `conversationId`) and 503 (provider down — safe to retry, same thread).
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
