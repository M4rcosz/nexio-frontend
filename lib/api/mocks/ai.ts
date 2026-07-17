// Mock fallback for the AI assistant endpoints (used when
// NEXT_PUBLIC_USE_MOCKS=true or the backend is unavailable). A single in-memory
// store of token wallets keyed by userId, plus a canned, deterministic
// assistant that meters tokens against the wallet.
//
// The mock throws `ApiError` with the same status codes the real backend uses
// (409 already-enrolled, 404 missing, 422 out-of-range, 403 no-access) so the
// BFF route handlers map both mock and live errors through one code path.
import { mockDelay } from './_delay'
import { ApiError } from '@/lib/api/errors'
import { AI_TOKEN_MAX } from '@/lib/validation/constants'
import type {
  AiMembership,
  ChatResponse,
  SendChatMessageRequest,
} from '@/lib/api/types'

const STORE = new Map<string, AiMembership>()

/** Default grant handed to a self-service caller on first read, so the mock
 * chat is usable out of the box (the real backend answers 404 until an admin
 * enrolls the user). */
const SELF_SERVE_SEED = 10_000

function make(userId: string, tokenBalance: number): AiMembership {
  return {
    id: `aim_${userId}`,
    userId,
    tokenBalance,
    createdAt: new Date().toISOString(),
  }
}

/**
 * `GET /ai/memberships/me`. Seeds a wallet for the caller on first read so the
 * demo assistant works without an admin enrolling them first.
 */
export async function getMyAiMembershipMock(
  userId: string,
): Promise<AiMembership> {
  await mockDelay()
  let m = STORE.get(userId)
  if (!m) {
    m = make(userId, SELF_SERVE_SEED)
    STORE.set(userId, m)
  }
  return { ...m }
}

/** `POST /ai/memberships/:userId` — one-time create; 409 if already enrolled. */
export async function enrollAiMembershipMock(
  userId: string,
  initialBalance: number,
): Promise<AiMembership> {
  await mockDelay()
  if (STORE.has(userId)) {
    throw new ApiError(409, null, 'User already has an AI membership.')
  }
  const m = make(userId, initialBalance)
  STORE.set(userId, m)
  return { ...m }
}

/**
 * `PATCH /ai/memberships/:userId/balance` — signed delta. `null` when the user
 * is not enrolled (404); throws 422 when the change would drive the balance
 * below zero or overflow the int4 ceiling.
 */
export async function adjustAiMembershipBalanceMock(
  userId: string,
  delta: number,
): Promise<AiMembership | null> {
  await mockDelay()
  const m = STORE.get(userId)
  if (!m) return null
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
  STORE.set(userId, m)
  return { ...m }
}

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

/**
 * `POST /ai/chat`. Throws 403 when the caller is not enrolled or already out of
 * tokens. Otherwise meters a best-effort cost (never below zero) and returns
 * the reply plus the remaining balance.
 */
export async function sendChatMessageMock(
  userId: string,
  body: SendChatMessageRequest,
): Promise<ChatResponse> {
  await mockDelay()
  const m = STORE.get(userId)
  if (!m || m.tokenBalance <= 0) {
    throw new ApiError(403, null, 'No AI access or out of tokens.')
  }
  // Rough token estimate: ~1 token per 4 chars of the prompt, min 40.
  const estimated = Math.max(40, Math.ceil(body.message.length / 4) + 40)
  const tokensSpent = Math.min(estimated, m.tokenBalance)
  m.tokenBalance = Math.max(0, m.tokenBalance - tokensSpent)
  STORE.set(userId, m)

  const reply =
    m.tokenBalance === 0
      ? `${cannedReply(body.message)}\n\n(Heads up: that used the last of your tokens — ask an admin to top up to keep chatting.)`
      : cannedReply(body.message)

  return { reply, tokensSpent, balanceRemaining: m.tokenBalance }
}
