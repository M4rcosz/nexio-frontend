import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import {
  createBusinessUnit,
  listBusinessUnitsInternal,
} from '@/lib/api/business-units'
import { ApiError, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { getAdminContext } from '@/lib/auth/access'

// `.strict()` rejects unknown keys (isActive, id, createdAt, …) with a 400 —
// units are born active; isActive is only editable through the activate/
// deactivate routes. cnpj must be exactly 14 digits, no mask.
const CreateBody = z
  .object({
    name: z.string().min(2).max(120),
    cnpj: z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits.'),
    address: z.string().min(2).max(200),
    city: z.string().min(2).max(120),
    phone: z.string().min(3).max(30),
  })
  .strict()

export async function POST(req: Request) {
  const admin = await getAdminContext()
  // ADMIN only, mirroring categories: MANAGER cannot manage business units.
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }

  const raw = await req.json().catch(() => null)

  let parsed: z.infer<typeof CreateBody>
  try {
    parsed = CreateBody.parse(raw)
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
    const unit = await createBusinessUnit(parsed)
    // Both the public list ('business-units') and the admin internal list
    // ('business-units:internal') are tag-cached and must be busted.
    revalidateTag('business-units')
    revalidateTag('business-units:internal')
    return NextResponse.json(unit, { status: 201 })
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      // The backend answers a single 409 for a duplicated cnpj OR phone and
      // does not tell them apart, so we surface a generic conflict message.
      return NextResponse.json(
        { error: 'CNPJ or phone already in use.', code: 'cnpj_or_phone_taken' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const search = url.searchParams.get('search') ?? undefined
  const city = url.searchParams.get('city') ?? undefined
  const isActiveRaw = url.searchParams.get('isActive')
  const isActive =
    isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined
  // Contract: 1..100, integer, default 20. Truncate fractional values.
  const limit = parseLimit(url.searchParams.get('limit'))

  try {
    const page = await listBusinessUnitsInternal({
      limit,
      cursor,
      search,
      city,
      isActive,
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
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
