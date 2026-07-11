import { NextResponse } from 'next/server'
import { z } from 'zod'
import { initInventory } from '@/lib/api/inventory'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'
import {
  initInventorySchema,
  type InitInventoryInput,
} from '@/lib/validation/inventory'

export async function POST(
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
      { error: 'You can only manage your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }

  let parsed: InitInventoryInput
  try {
    // The unit comes from the URL only — never trust a businessUnitId in the body.
    parsed = initInventorySchema.parse(await req.json())
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
    const item = await initInventory(businessUnitId, parsed)
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    // Both the live backend (ApiError 409/404) and the mock (coded Error) map
    // to the same friendly responses.
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (
      code === 'inventory_exists' ||
      (err instanceof ApiError && err.status === 409)
    ) {
      return NextResponse.json(
        {
          error: 'A stock balance already exists for this product at the unit.',
          code: 'inventory_exists',
        },
        { status: 409 },
      )
    }
    if (
      code === 'inventory_not_found' ||
      (err instanceof ApiError && err.status === 404)
    ) {
      return NextResponse.json(
        {
          error: 'The product is not available at this unit.',
          code: 'inventory_not_found',
        },
        { status: 404 },
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
