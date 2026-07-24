// `GET /users?role=CUSTOMER` — the customer base.
//
// Split from `/api/admin/users` on purpose: that route is scoped to the
// actor's `manageableRoles`, and CUSTOMER is in nobody's. Reaching customers
// is an ADMIN-only read because they carry no business-unit links, so a
// MANAGER — always pinned to their own units by the backend — can never see
// one. See docs/frontend-users-and-business-units.md §1.3.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listCustomers } from '@/lib/api/admin-users'
import { ApiError, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { getAdminContext } from '@/lib/auth/access'

// `cursor` is an opaque keyset token, NOT a row id — never type it as a uuid,
// which would reject every real cursor before it is ever sent. The only bound
// worth enforcing is the backend's 512-char cap.
const ListQuery = z.object({
  search: z.string().max(50).optional(),
  email: z.string().max(120).optional(),
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

  // Validated locally so an over-long filter is a 400 here, rather than a
  // wasted round-trip returning an unactionable generic upstream 400. Bounds
  // mirror the contract (§1.2). A *malformed* cursor is not knowable here —
  // only the backend can tell, and it answers 422 (handled below).
  let query: z.infer<typeof ListQuery>
  try {
    query = ListQuery.parse({
      search: url.searchParams.get('search') ?? undefined,
      email: url.searchParams.get('email') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid query.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }

  try {
    const page = await listCustomers(ctx, {
      ...query,
      limit: parseLimit(url.searchParams.get('limit')),
    })
    return NextResponse.json(page)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    // A stale or malformed keyset cursor is 422, not 400. Tag it so the client
    // drops the cursor and restarts from page 1 instead of retrying a token
    // that can only ever fail again.
    if (status === 422) {
      return NextResponse.json(
        {
          error: 'The list changed. Reset to the first page.',
          code: 'invalid_cursor',
        },
        { status: 422 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
