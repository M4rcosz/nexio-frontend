import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { reinstateAiMembership } from '@/lib/api/ai'
import { backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

/**
 * Undo a revoke (ADMIN). Balance and everything else are restored — a revoke
 * never touched them. Idempotent upstream: reinstating an active membership
 * returns the current row rather than an error, so no guard is needed here.
 */
export async function POST(
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
    const membership = await reinstateAiMembership(userId)
    if (!membership) {
      // No wallet at all — reinstating is meaningless; the admin must enroll.
      return NextResponse.json(
        { error: 'User is not enrolled.', code: 'not_enrolled' },
        { status: 404 },
      )
    }
    // The admin usage report is a tagged server read; without this a
    // freshly changed membership would not show up until the tag expires.
    revalidateTag('ai-memberships')
    return NextResponse.json(membership)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
