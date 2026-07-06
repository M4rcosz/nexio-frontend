import { NextResponse } from 'next/server'
import { z } from 'zod'
import { setMenuItemAvailable } from '@/lib/api/menu'
import { describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

// Single toggle route: `{ isAvailable }` maps to the backend's idempotent
// activate/deactivate endpoints via `setMenuItemAvailable`.
const Body = z.object({ isAvailable: z.boolean() }).strict()

export async function POST(
  req: Request,
  ctx: { params: Promise<{ businessUnitId: string; menuItemId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { businessUnitId, menuItemId } = await ctx.params
  // Validate ids before they are concatenated into the backend URL.
  if (
    !z.string().uuid().safeParse(businessUnitId).success ||
    !z.string().uuid().safeParse(menuItemId).success
  ) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }
  // MANAGER may only manage units within their scope.
  if (!canAccessUnit(admin, businessUnitId)) {
    return NextResponse.json(
      { error: 'You can only manage your own unit.', code: 'unit_forbidden' },
      { status: 403 },
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
    const item = await setMenuItemAvailable(
      businessUnitId,
      menuItemId,
      parsed.isAvailable,
    )
    if (!item) {
      return NextResponse.json({ error: 'Menu item not found.' }, { status: 404 })
    }
    return NextResponse.json(item)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
