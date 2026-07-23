import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listPromotionsByBusinessUnit } from '@/lib/api/promotions'
import { ApiError, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

// `cursor` is an opaque keyset token, NOT a row id — never type it as a uuid,
// which would reject every real cursor. The only bound worth enforcing locally
// is the backend's 512-char cap.
const Cursor = z.string().max(512)

export async function GET(
  req: Request,
  ctx: { params: Promise<{ businessUnitId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { businessUnitId } = await ctx.params
  if (!canAccessUnit(admin, businessUnitId)) {
    return NextResponse.json(
      { error: 'You can only view your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }
  const url = new URL(req.url)
  const rawCursor = url.searchParams.get('cursor')
  if (rawCursor !== null && !Cursor.safeParse(rawCursor).success) {
    return NextResponse.json(
      { error: 'Invalid cursor.', code: 'invalid_cursor' },
      { status: 400 },
    )
  }
  try {
    const page = await listPromotionsByBusinessUnit(businessUnitId, {
      // Clamped to the contract's 1..100 range so an out-of-range value never
      // reaches the backend as an unactionable 400.
      limit: parseLimit(url.searchParams.get('limit')),
      cursor: rawCursor ?? undefined,
    })
    return NextResponse.json(page)
  } catch (err) {
    // A stale or malformed keyset cursor is 422, not 400. Tag it so the client
    // drops the cursor and restarts from page 1 instead of retrying a token
    // that can only ever fail again.
    if (err instanceof ApiError && err.status === 422) {
      return NextResponse.json(
        {
          error: 'The list changed. Reset to the first page.',
          code: 'invalid_cursor',
        },
        { status: 422 },
      )
    }
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json(
        { error: describeError(err) },
        { status: err.status },
      )
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
