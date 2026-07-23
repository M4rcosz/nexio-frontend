// Read and soft-delete one of the caller's own chat threads.
//
// Both verbs are self-scoped upstream from the JWT. A thread that belongs to
// someone else, was deleted, or never existed all answer 404 *identically* —
// that is deliberate, so this handler must not distinguish them either, and the
// status is never a signal about whether an id exists.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { deleteAiConversation, getAiConversation } from '@/lib/api/ai'
import { backendErrorStatus, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

const NOT_FOUND = {
  error: 'Conversation not found.',
  code: 'conversation_not_found',
} as const

/** Rejects a non-UUID before the round-trip; upstream would 400 on it anyway. */
const ConversationId = z.string().uuid()

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json(
      { error: 'Not authenticated.', code: 'session_expired' },
      { status: 401 },
    )
  }
  const { conversationId } = await params
  if (!ConversationId.safeParse(conversationId).success) {
    // Same body as a real miss — a malformed id must not read differently from
    // an id that simply isn't the caller's.
    return NextResponse.json(NOT_FOUND, { status: 404 })
  }

  try {
    const conversation = await getAiConversation(conversationId)
    if (!conversation) return NextResponse.json(NOT_FOUND, { status: 404 })
    return NextResponse.json(conversation)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}

/**
 * Soft delete. Idempotent upstream — deleting an already-deleted thread returns
 * the same row with `isDeleted: true`, not a 404 — so a double-click or a retry
 * needs no guard. There is no undelete, and the thread can no longer be
 * continued afterwards. Token spend is untouched: it lives in a per-user ledger,
 * so this never changes what the admin usage report shows.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json(
      { error: 'Not authenticated.', code: 'session_expired' },
      { status: 401 },
    )
  }
  const { conversationId } = await params
  if (!ConversationId.safeParse(conversationId).success) {
    return NextResponse.json(NOT_FOUND, { status: 404 })
  }

  try {
    const deleted = await deleteAiConversation(conversationId)
    if (!deleted) return NextResponse.json(NOT_FOUND, { status: 404 })
    return NextResponse.json(deleted)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
