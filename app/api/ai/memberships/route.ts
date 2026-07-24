// `GET /ai/memberships` — the ADMIN usage report: who holds an AI membership
// and how many tokens they burned inside a window.
//
// This is the only AI endpoint that exposes user emails, which is why it is
// ADMIN-gated rather than staff-gated. Never proxy it to a non-admin view and
// never log its body client-side.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listAiMembershipUsage } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { getAdminContext } from '@/lib/auth/access'

// Shape only. The `from <= to` ordering is checked separately below so a
// malformed date (a 400 "bad request") is never conflated with a well-formed
// but inverted range (a 422 the client treats as a period error).
const ListQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().max(512).optional(),
})

export async function GET(req: Request) {
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

  const url = new URL(req.url)

  let query: z.infer<typeof ListQuery>
  try {
    query = ListQuery.parse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    })
  } catch (err) {
    // Malformed shape (a non-ISO date, an over-long cursor): a plain 400, not a
    // 422 — otherwise the client's cursor-recovery treats it as a stale keyset
    // and burns a guaranteed-identical retry.
    return NextResponse.json(
      {
        error: 'Invalid query.',
        code: 'invalid_query',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }

  // Well-formed but inverted range: caught here so it costs no round-trip;
  // upstream answers 422 for the same case and the client renders one message.
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    return NextResponse.json(
      {
        error: 'The start of the period must not be after its end.',
        code: 'invalid_period',
      },
      { status: 422 },
    )
  }

  try {
    const report = await listAiMembershipUsage({
      ...query,
      limit: parseLimit(url.searchParams.get('limit')),
    })
    return NextResponse.json(report)
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      // Upstream rejects a malformed cursor with 422 (not 400) — the list has
      // moved on, so the client resets to the first page.
      return NextResponse.json(
        { error: 'Invalid cursor or period.', code: 'invalid_cursor' },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
