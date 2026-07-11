import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adjustInventory } from '@/lib/api/inventory'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'
import {
  adjustInventorySchema,
  type AdjustInventoryInput,
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
      { error: 'You can only adjust your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }

  let parsed: AdjustInventoryInput
  try {
    parsed = adjustInventorySchema.parse(await req.json())
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
    const item = await adjustInventory(businessUnitId, parsed)
    return NextResponse.json(item)
  } catch (err) {
    // Both the live backend (ApiError 404/422) and the mock (coded Error) map
    // to the same friendly responses.
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (
      code === 'inventory_not_found' ||
      (err instanceof ApiError && err.status === 404)
    ) {
      return NextResponse.json(
        {
          error: 'No stock balance exists for this product at the unit.',
          code: 'inventory_not_found',
        },
        { status: 404 },
      )
    }
    // A 422 is ambiguous on the wire, so we synthesize the code from the request
    // `type` we already parsed (the repo convention ignores the backend message):
    // an OUT that 422s went below zero; an IN that 422s exceeded the max.
    if (code === 'inventory_over_max' || code === 'inventory_below_zero') {
      const status = 422
      return NextResponse.json(
        code === 'inventory_over_max'
          ? {
              error: 'This restock would exceed the maximum quantity.',
              code: 'inventory_over_max',
            }
          : {
              error: 'This removal would drive the balance below zero.',
              code: 'inventory_below_zero',
            },
        { status },
      )
    }
    if (err instanceof ApiError && err.status === 422) {
      return parsed.type === 'IN'
        ? NextResponse.json(
            {
              error: 'This restock would exceed the maximum quantity.',
              code: 'inventory_over_max',
            },
            { status: 422 },
          )
        : NextResponse.json(
            {
              error: 'This removal would drive the balance below zero.',
              code: 'inventory_below_zero',
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
