import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import {
  getBusinessUnitInternal,
  updateBusinessUnit,
} from '@/lib/api/business-units'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

// `.strict()` rejects unknown keys (cnpj, isActive, id, timestamps, …) with a
// 400. Every field is optional but at least one must be present — the client
// sends only the fields that actually changed.
const PatchBody = z
  .object({
    name: z.string().min(2).max(120).optional(),
    address: z.string().min(2).max(200).optional(),
    city: z.string().min(2).max(120).optional(),
    phone: z.string().min(3).max(30).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required.',
  })

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  // Validate the id before it is concatenated into the backend URL — guards
  // against path/query injection through serverFetch's URL building.
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Invalid business unit id.' },
      { status: 400 },
    )
  }
  try {
    const unit = await getBusinessUnitInternal(id)
    if (!unit) {
      return NextResponse.json(
        { error: 'Business unit not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json(unit)
  } catch (err) {
    // `backendErrorStatus` normalizes `err.status || 500` first. A bare
    // `err.status < 500` is wrong: `serverFetch` throws `ApiError(0, …)` on a
    // network failure or the 4s timeout, and passing 0 to `NextResponse.json`
    // is outside the legal 200..599 range, so it throws a RangeError and the
    // caller gets an opaque framework 500 exactly when the backend is down.
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  // ADMIN only, mirroring categories.
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

  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Invalid business unit id.' },
      { status: 400 },
    )
  }

  const raw = await req.json().catch(() => null)

  let parsed: z.infer<typeof PatchBody>
  try {
    parsed = PatchBody.parse(raw)
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
    const unit = await updateBusinessUnit(id, parsed)
    if (!unit) {
      return NextResponse.json(
        { error: 'Business unit not found.' },
        { status: 404 },
      )
    }
    revalidateTag('business-units')
    revalidateTag('business-units:internal')
    revalidateTag(`business-units:${id}`)
    return NextResponse.json(unit)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      // On PATCH only the phone can collide (cnpj is immutable).
      return NextResponse.json(
        { error: 'Phone already in use.', code: 'phone_taken' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
