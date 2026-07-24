// Read and soft-delete one of the caller's own chat threads.
//
// Both verbs are self-scoped upstream from the JWT. A thread that belongs to
// someone else, was deleted, or never existed all answer 404 *identically* —
// that is deliberate, so this handler must not distinguish them either, and the
// status is never a signal about whether an id exists.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deleteAiConversation,
  getAiConversation,
  renameAiConversation,
} from '@/lib/api/ai'
import { backendErrorStatus, describeError } from '@/lib/api/errors'
import { isValidTitle } from '@/lib/ai/title'
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

/** Body zod: `title` must be a string; content rules (blank/>80) are enforced
 *  separately with `isValidTitle` so they can answer 422, not 400. */
const RenameBody = z.object({ title: z.string() })

/**
 * Rename. Self-scoped upstream like the other verbs. No `revalidateTag`:
 * conversations are client-fetched with `no-store`, never RSC-cached, so there
 * is no tag to invalidate — the client patches the renamed row in place.
 */
export async function PATCH(
  req: Request,
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

  let title: string
  try {
    title = RenameBody.parse(await req.json()).title
  } catch {
    // A non-string / malformed body is a client mistake — 400, not 422.
    return NextResponse.json(
      { error: 'Invalid payload.', code: 'invalid_body' },
      { status: 400 },
    )
  }

  // Blank or over the code-point cap: the value is well-formed but out of range.
  if (!isValidTitle(title)) {
    return NextResponse.json(
      { error: 'Title must be 1–80 characters.', code: 'title_invalid' },
      { status: 422 },
    )
  }

  try {
    const renamed = await renameAiConversation(conversationId, title)
    if (!renamed) return NextResponse.json(NOT_FOUND, { status: 404 })
    return NextResponse.json(renamed)
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
