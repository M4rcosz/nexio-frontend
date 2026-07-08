import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addMenuItem } from '@/lib/api/menu'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

// Positive decimal string with ≤2 places; "0"/"0.00" are rejected.
const MONEY = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')
  .refine((v) => Number(v) > 0, 'Must be greater than zero.')

// `.strict()` rejects unknown keys (id, businessUnitId, timestamps, …).
const AddBody = z
  .object({
    productId: z.string().uuid(),
    customPrice: MONEY,
    isAvailable: z.boolean().optional(),
  })
  .strict()

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id: businessUnitId } = await ctx.params
  // Validate the id before it is concatenated into the backend URL — guards
  // against path/query injection through serverFetch's URL building.
  if (!z.string().uuid().safeParse(businessUnitId).success) {
    return NextResponse.json(
      { error: 'Invalid business unit id.' },
      { status: 400 },
    )
  }
  // MANAGER may only manage units within their scope.
  if (!canAccessUnit(admin, businessUnitId)) {
    return NextResponse.json(
      { error: 'You can only manage your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }

  const raw = await req.json().catch(() => null)

  let parsed: z.infer<typeof AddBody>
  try {
    parsed = AddBody.parse(raw)
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
    const item = await addMenuItem(businessUnitId, parsed)
    return NextResponse.json(item, { status: 201 })
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
