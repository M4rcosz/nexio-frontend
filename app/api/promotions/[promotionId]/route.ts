import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPromotion, updatePromotion } from '@/lib/api/promotions'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

const MONEY = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')

const PatchBody = z.object({
  name: z.string().min(2).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: MONEY.optional(),
  minOrderValue: MONEY.optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required.',
})

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ promotionId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { promotionId } = await ctx.params
  try {
    const promotion = await getPromotion(promotionId)
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found.' }, { status: 404 })
    }
    if (!canAccessUnit(admin, promotion.businessUnitId)) {
      return NextResponse.json(
        { error: 'You can only view your own unit.', code: 'unit_forbidden' },
        { status: 403 },
      )
    }
    return NextResponse.json(promotion)
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status: err.status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ promotionId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { promotionId } = await ctx.params
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null

  if (raw && raw.discountType === 'FREE_ITEM') {
    return NextResponse.json(
      { error: 'FREE_ITEM promotions are not supported.', code: 'free_item_unsupported' },
      { status: 400 },
    )
  }

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
    // MANAGER scope check: load the current promotion first.
    if (admin.role === 'MANAGER') {
      const current = await getPromotion(promotionId)
      if (!current) {
        return NextResponse.json(
          { error: 'Promotion not found.' },
          { status: 404 },
        )
      }
      if (!canAccessUnit(admin, current.businessUnitId)) {
        return NextResponse.json(
          { error: 'You can only edit your own unit.', code: 'unit_forbidden' },
          { status: 403 },
        )
      }
    }
    const promotion = await updatePromotion(promotionId, parsed)
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found.' }, { status: 404 })
    }
    return NextResponse.json(promotion)
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status: err.status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
