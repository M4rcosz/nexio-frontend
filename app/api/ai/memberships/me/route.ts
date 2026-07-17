import { NextResponse } from 'next/server'
import { getMyAiMembership } from '@/lib/api/ai'
import { backendErrorStatus, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

/**
 * The caller's own AI token wallet. `404 { code: 'not_enrolled' }` is an
 * expected state (no admin has granted AI access yet) — the client renders an
 * empty "no AI access" view, not an error.
 */
export async function GET() {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  try {
    const membership = await getMyAiMembership()
    if (!membership) {
      return NextResponse.json(
        { error: 'No AI membership.', code: 'not_enrolled' },
        { status: 404 },
      )
    }
    return NextResponse.json(membership)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
