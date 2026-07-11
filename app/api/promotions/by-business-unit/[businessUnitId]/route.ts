import { NextResponse } from 'next/server'
import { listPromotionsByBusinessUnit } from '@/lib/api/promotions'
import { ApiError, describeError } from '@/lib/api/errors'
import { canAccessUnit, getAdminContext } from '@/lib/auth/access'

export async function GET(
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
      { error: 'You can only view your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }
  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limit = limitParam ? Number(limitParam) : undefined
  try {
    const page = await listPromotionsByBusinessUnit(businessUnitId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    })
    return NextResponse.json(page)
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
