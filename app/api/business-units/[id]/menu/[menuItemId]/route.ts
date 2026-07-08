import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { updateMenuItem } from '@/lib/api/menu'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

// Positive decimal string with ≤2 places; "0"/"0.00" are rejected.
const MONEY = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')
  .refine((v) => Number(v) > 0, 'Must be greater than zero.')

// `.strict()` rejects unknown keys; at least one field must be present.
const PatchBody = z
  .object({
    customPrice: MONEY.optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required.',
  })

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; menuItemId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id: businessUnitId, menuItemId } = await ctx.params
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
    const item = await updateMenuItem(businessUnitId, menuItemId, parsed)
    if (!item) {
      return NextResponse.json(
        { error: 'Menu item not found.' },
        { status: 404 },
      )
    }
    revalidateTag(`menu:${businessUnitId}`)
    return NextResponse.json(item)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        { error: 'Product already on the menu.', code: 'menu_item_exists' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
