import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { setBusinessUnitActive } from '@/lib/api/business-units'
import { describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

// Single toggle route: `{ isActive }` maps to the backend's idempotent
// activate/deactivate endpoints via `setBusinessUnitActive`.
const Body = z.object({ isActive: z.boolean() })

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  // ADMIN only, mirroring the rest of the business-unit management surface.
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Invalid business unit id.' },
      { status: 400 },
    )
  }
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
    const unit = await setBusinessUnitActive(id, parsed.isActive)
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
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
