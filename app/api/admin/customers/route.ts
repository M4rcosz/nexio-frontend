// `GET /users?role=CUSTOMER` — the customer base.
//
// Split from `/api/admin/users` on purpose: that route is scoped to the
// actor's `manageableRoles`, and CUSTOMER is in nobody's. Reaching customers
// is an ADMIN-only read because they carry no business-unit links, so a
// MANAGER — always pinned to their own units by the backend — can never see
// one. See docs/frontend-users-and-business-units.md §1.3.
import { NextResponse } from 'next/server'
import { listCustomers } from '@/lib/api/admin-users'
import { ApiError, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { getAdminContext } from '@/lib/auth/access'

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
  try {
    const page = await listCustomers(ctx, {
      search: url.searchParams.get('search') ?? undefined,
      email: url.searchParams.get('email') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: parseLimit(url.searchParams.get('limit')),
    })
    return NextResponse.json(page)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
