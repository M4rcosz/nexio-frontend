import { NextResponse } from 'next/server'
import { listInventory } from '@/lib/api/inventory'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ businessUnitId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { businessUnitId } = await ctx.params
  // MANAGER may only read their own unit.
  if (
    admin.role === 'MANAGER' &&
    admin.scopedBusinessUnitId !== businessUnitId
  ) {
    return NextResponse.json(
      { error: 'You can only view your own unit.', code: 'unit_forbidden' },
      { status: 403 },
    )
  }
  try {
    const items = await listInventory(businessUnitId)
    return NextResponse.json({ data: items })
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status: err.status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
