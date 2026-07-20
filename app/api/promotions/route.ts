import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createPromotion } from '@/lib/api/promotions'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

const MONEY = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')

const CreateBody = z.object({
  /** Required for ADMIN; ignored for MANAGER (forced to their own unit). */
  businessUnitId: z.string().min(1).optional(),
  name: z.string().min(2),
  // FREE_ITEM is intentionally excluded — the promotion schema cannot model it.
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: MONEY,
  minOrderValue: MONEY,
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean(),
})

export async function POST(req: Request) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const raw = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  // Guard FREE_ITEM explicitly so the message is clear even before Zod runs.
  if (raw && raw.discountType === 'FREE_ITEM') {
    return NextResponse.json(
      {
        error: 'FREE_ITEM promotions are not supported.',
        code: 'free_item_unsupported',
      },
      { status: 400 },
    )
  }

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

  // MANAGER is forced to their own unit; ADMIN must supply one explicitly.
  let businessUnitId: string
  if (admin.role === 'MANAGER' && admin.scopedBusinessUnitId) {
    businessUnitId = admin.scopedBusinessUnitId
  } else {
    if (!parsed.businessUnitId) {
      return NextResponse.json(
        { error: 'Business unit is required.', code: 'unit_required' },
        { status: 400 },
      )
    }
    businessUnitId = parsed.businessUnitId
  }

  try {
    const promotion = await createPromotion({ ...parsed, businessUnitId })
    revalidateTag(`promotions:${businessUnitId}`)
    return NextResponse.json(promotion, { status: 201 })
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json(
        { error: describeError(err) },
        { status: err.status },
      )
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
