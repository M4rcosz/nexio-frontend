import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enrollAiMembership, revokeAiMembership } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { AI_TOKEN_MAX, AI_TOKEN_MIN } from '@/lib/validation/constants'

// Enroll/adjust are ADMIN-only per the contract (MANAGER gets a backend 403).
const Body = z.object({
  initialBalance: z.number().int().min(AI_TOKEN_MIN).max(AI_TOKEN_MAX),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (ctx.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }
  const { userId } = await params

  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }

  try {
    const membership = await enrollAiMembership(userId, parsed.initialBalance)
    // The admin usage report is a tagged server read; without this a
    // freshly changed membership would not show up until the tag expires.
    revalidateTag('ai-memberships')
    return NextResponse.json(membership, { status: 201 })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // Already enrolled — the client falls back to the adjust (PATCH) flow.
      return NextResponse.json(
        {
          error: 'User already has an AI membership.',
          code: 'already_enrolled',
        },
        { status: 409 },
      )
    }
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json(
        { error: 'User not found.', code: 'user_not_found' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}

/**
 * Soft revoke: blocks all AI use while keeping the row and its balance. The
 * upstream call is idempotent — re-revoking returns the same row, not an error
 * — so the client needs no double-submit guard.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (ctx.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }
  const { userId } = await params

  try {
    const membership = await revokeAiMembership(userId)
    if (!membership) {
      return NextResponse.json(
        { error: 'User is not enrolled.', code: 'not_enrolled' },
        { status: 404 },
      )
    }
    revalidateTag('ai-memberships')
    return NextResponse.json(membership)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
