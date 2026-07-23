// Mock fallback for the AI assistant endpoints (used when
// NEXT_PUBLIC_USE_MOCKS=true or the backend is unavailable). Three in-memory
// stores mirror the backend's own split:
//   - WALLETS       token wallets keyed by userId (balance + revoke state)
//   - CONVERSATIONS server-owned threads, each with its full transcript
//   - LEDGER        append-only spend entries, the source of the admin report
//
// The ledger is deliberately separate from the conversations: deleting a thread
// must never change reported spend, exactly as the contract states.
//
// The mock throws `ApiError` with the same status codes the real backend uses
// (409 already-enrolled, 404 missing, 422 out-of-range, 403 no-access) so the
// BFF route handlers map both mock and live errors through one code path.
import { mockDelay } from './_delay'
import { cursorStart, encodeMockCursor } from './_cursor'
import { findUserBySubMock } from './admin-users'
import { ApiError } from '@/lib/api/errors'
import {
  AI_TOKEN_MAX,
  CHAT_MESSAGE_MAX_LENGTH,
} from '@/lib/validation/constants'
import type {
  AiConversationDetail,
  AiConversationSummary,
  AiMembership,
  AiMembershipUsage,
  AiUsageReport,
  AiUsageReportQuery,
  ChatResponse,
  Paginated,
  SendChatMessageRequest,
} from '@/lib/api/types'

const WALLETS = new Map<string, AiMembership>()

type StoredConversation = AiConversationDetail & { userId: string }

const CONVERSATIONS = new Map<string, StoredConversation>()

/** Append-only spend entries. Never pruned when a thread is deleted. */
const LEDGER: { userId: string; tokens: number; at: string }[] = []

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

/** Default grant handed to a self-service caller on first read, so the mock
 * chat is usable out of the box (the real backend answers 404 until an admin
 * enrolls the user). */
const SELF_SERVE_SEED = 10_000

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function make(userId: string, tokenBalance: number): AiMembership {
  return {
    id: `aim_${userId}`,
    userId,
    tokenBalance,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  }
}

/**
 * Slices an already-sorted list into the backend's cursor envelope, using the
 * same opaque keyset token the live API issues (see `_cursor.ts`).
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

// --- Memberships ---

/**
 * `GET /ai/memberships/me`. Seeds a wallet for the caller on first read so the
 * demo assistant works without an admin enrolling them first.
 */
export async function getMyAiMembershipMock(
  userId: string,
): Promise<AiMembership> {
  await mockDelay()
  let m = WALLETS.get(userId)
  if (!m) {
    m = make(userId, SELF_SERVE_SEED)
    WALLETS.set(userId, m)
  }
  return { ...m }
}

/** `POST /ai/memberships/:userId` — one-time create; 409 if already enrolled. */
export async function enrollAiMembershipMock(
  userId: string,
  initialBalance: number,
): Promise<AiMembership> {
  await mockDelay()
  if (WALLETS.has(userId)) {
    throw new ApiError(409, null, 'User already has an AI membership.')
  }
  const m = make(userId, initialBalance)
  WALLETS.set(userId, m)
  return { ...m }
}

/**
 * `PATCH /ai/memberships/:userId/balance` — signed delta. `null` when the user
 * is not enrolled (404); throws 403 while revoked (reinstate first) and 422
 * when the change would drive the balance below zero or overflow the ceiling.
 */
export async function adjustAiMembershipBalanceMock(
  userId: string,
  delta: number,
): Promise<AiMembership | null> {
  await mockDelay()
  const m = WALLETS.get(userId)
  if (!m) return null
  if (m.revokedAt) {
    throw new ApiError(403, null, 'This user AI membership has been revoked.')
  }
  const next = m.tokenBalance + delta
  if (next < 0) {
    throw new ApiError(
      422,
      null,
      `Adjustment of ${delta} would drive the balance below zero.`,
    )
  }
  if (next > AI_TOKEN_MAX) {
    throw new ApiError(
      422,
      null,
      'Adjustment would overflow the maximum token balance.',
    )
  }
  m.tokenBalance = next
  WALLETS.set(userId, m)
  return { ...m }
}

/**
 * `DELETE /ai/memberships/:userId` — soft revoke, balance preserved. `null`
 * when not enrolled (404). Idempotent: re-revoking keeps the original
 * `revokedAt` rather than sliding the timestamp forward.
 */
export async function revokeAiMembershipMock(
  userId: string,
): Promise<AiMembership | null> {
  await mockDelay()
  const m = WALLETS.get(userId)
  if (!m) return null
  if (!m.revokedAt) m.revokedAt = new Date().toISOString()
  WALLETS.set(userId, m)
  return { ...m }
}

/**
 * `POST /ai/memberships/:userId/reinstate` — clears the revoke. `null` when not
 * enrolled (404). Idempotent: reinstating an active membership is a no-op.
 */
export async function reinstateAiMembershipMock(
  userId: string,
): Promise<AiMembership | null> {
  await mockDelay()
  const m = WALLETS.get(userId)
  if (!m) return null
  m.revokedAt = null
  WALLETS.set(userId, m)
  return { ...m }
}

/**
 * `GET /ai/memberships` (ADMIN) — every wallet with its spend inside the
 * window. Revoked members stay in the report; revoking hides nothing.
 */
export async function listAiMembershipUsageMock(
  query: AiUsageReportQuery = {},
): Promise<AiUsageReport> {
  await mockDelay()
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  if (from.getTime() > to.getTime()) {
    throw new ApiError(422, null, '`from` must not be after `to`.')
  }

  const rows: AiMembershipUsage[] = [...WALLETS.values()]
    // Newest wallet first, so a freshly enrolled user is visible immediately.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => {
      const user = findUserBySubMock(m.userId)
      const spent = LEDGER.filter(
        (e) =>
          e.userId === m.userId &&
          new Date(e.at) >= from &&
          new Date(e.at) <= to,
      ).reduce((sum, e) => sum + e.tokens, 0)
      return {
        id: m.id,
        userId: m.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        tokenBalance: m.tokenBalance,
        tokensUsedInPeriod: spent,
        isRevoked: m.revokedAt !== null,
        revokedAt: m.revokedAt,
        createdAt: m.createdAt,
      }
    })

  return {
    ...paginate(rows, query.limit, query.cursor),
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
  }
}

// --- Conversations ---

function summarize(c: StoredConversation): AiConversationSummary {
  return {
    id: c.id,
    isDeleted: c.isDeleted,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

/** Rows the caller may see: theirs, not deleted, last activity first. */
function visibleFor(userId: string): StoredConversation[] {
  return [...CONVERSATIONS.values()]
    .filter((c) => c.userId === userId && !c.isDeleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** `GET /ai/conversations` — self-scoped, cursor-paginated. */
export async function listAiConversationsMock(
  userId: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<Paginated<AiConversationSummary>> {
  await mockDelay()
  const rows = visibleFor(userId).map(summarize)
  return paginate(rows, query.limit, query.cursor)
}

/**
 * `GET /ai/conversations/:id`. `null` for someone else's thread, a deleted one
 * or an unknown id — all three are the same 404 upstream, on purpose.
 */
export async function getAiConversationMock(
  userId: string,
  conversationId: string,
): Promise<AiConversationDetail | null> {
  await mockDelay()
  const c = CONVERSATIONS.get(conversationId)
  if (!c || c.userId !== userId || c.isDeleted) return null
  return { ...summarize(c), messages: c.messages.map((m) => ({ ...m })) }
}

/**
 * `DELETE /ai/conversations/:id` — soft delete. Idempotent: deleting an
 * already-deleted thread returns the same row rather than a 404. Spend stays in
 * the ledger, so the admin report is untouched.
 */
export async function deleteAiConversationMock(
  userId: string,
  conversationId: string,
): Promise<AiConversationSummary | null> {
  await mockDelay()
  const c = CONVERSATIONS.get(conversationId)
  if (!c || c.userId !== userId) return null
  c.isDeleted = true
  CONVERSATIONS.set(conversationId, c)
  return summarize(c)
}

// --- Chat ---

/** A canned, deterministic reply so the mock reads like a real support bot. */
function cannedReply(message: string): string {
  const q = message.toLowerCase()
  if (q.includes('order') || q.includes('pedido')) {
    return 'I can look up your orders once the backend assistant is connected. In this demo I can only echo that you asked about an order.'
  }
  if (q.includes('point') || q.includes('ponto') || q.includes('loyalty')) {
    return 'Your loyalty points are tied to your account — the live assistant reads them server-side. This is a demo reply.'
  }
  return `You said: “${message.trim()}”. I'm the demo assistant — connect the backend to get real answers about your orders and points.`
}

function appendTurn(
  c: StoredConversation,
  role: 'USER' | 'MODEL',
  content: string,
  at: string,
) {
  c.messages.push({ id: newId(), role, content, createdAt: at })
  c.updatedAt = at
}

/**
 * `POST /ai/chat`. Throws 403 when the caller is not enrolled, revoked or out
 * of tokens, and 404 when `conversationId` is not a live thread of theirs.
 * Otherwise meters a best-effort cost (never below zero), stores both turns and
 * returns the reply plus the remaining balance.
 */
export async function sendChatMessageMock(
  userId: string,
  body: SendChatMessageRequest,
): Promise<ChatResponse> {
  await mockDelay()
  const m = WALLETS.get(userId)
  if (!m) {
    throw new ApiError(403, null, 'This user has no AI membership enrollment.')
  }
  if (m.revokedAt) {
    throw new ApiError(403, null, 'This user AI membership has been revoked.')
  }
  if (m.tokenBalance <= 0) {
    throw new ApiError(403, null, 'This user has run out of AI tokens.')
  }

  const now = new Date().toISOString()

  let conversation: StoredConversation
  if (body.conversationId) {
    const existing = CONVERSATIONS.get(body.conversationId)
    if (!existing || existing.userId !== userId || existing.isDeleted) {
      throw new ApiError(404, null, 'Conversation not found.')
    }
    conversation = existing
  } else {
    conversation = {
      id: newId(),
      userId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    // `history` seeds a brand new thread only — mirroring the server, which
    // ignores it entirely once a conversationId is in play.
    for (const turn of body.history ?? []) {
      appendTurn(
        conversation,
        turn.role === 'user' ? 'USER' : 'MODEL',
        turn.text.slice(0, CHAT_MESSAGE_MAX_LENGTH),
        now,
      )
    }
    CONVERSATIONS.set(conversation.id, conversation)
  }

  // Rough token estimate: ~1 token per 4 chars of the prompt, min 40.
  const estimated = Math.max(40, Math.ceil(body.message.length / 4) + 40)
  const tokensSpent = Math.min(estimated, m.tokenBalance)
  m.tokenBalance = Math.max(0, m.tokenBalance - tokensSpent)
  WALLETS.set(userId, m)
  LEDGER.push({ userId, tokens: tokensSpent, at: now })

  const reply =
    m.tokenBalance === 0
      ? `${cannedReply(body.message)}\n\n(Heads up: that used the last of your tokens — ask an admin to top up to keep chatting.)`
      : cannedReply(body.message)

  appendTurn(conversation, 'USER', body.message, now)
  appendTurn(conversation, 'MODEL', reply, now)
  CONVERSATIONS.set(conversation.id, conversation)

  return {
    conversationId: conversation.id,
    reply,
    tokensSpent,
    balanceRemaining: m.tokenBalance,
  }
}
