// `GET /ai/conversations` — the caller's own chat threads.
//
// Self-scoped from the JWT upstream: there is no `:userId` param and no way to
// reach anyone else's threads, so this handler only needs an authenticated
// session, not a role gate.
import { NextResponse } from 'next/server'
import { listAiConversations } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

export async function GET(req: Request) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json(
      { error: 'Not authenticated.', code: 'session_expired' },
      { status: 401 },
    )
  }

  const url = new URL(req.url)

  try {
    const page = await listAiConversations({
      limit: parseLimit(url.searchParams.get('limit')),
      // Opaque upstream token — forwarded verbatim, never parsed or rebuilt.
      cursor: url.searchParams.get('cursor') ?? undefined,
    })
    return NextResponse.json(page)
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      // A malformed cursor is a 422 here, not a 400. The list moved on, so the
      // client resets to the first page rather than retrying the dead cursor.
      return NextResponse.json(
        { error: 'Invalid cursor.', code: 'invalid_cursor' },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
