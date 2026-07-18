import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listActivePromotions } from '@/lib/api/promotions'

/**
 * Public, read-only view of the promotions currently running for a unit —
 * consumed by customer surfaces (checkout estimate). Unlike the admin
 * routes this needs no role: `listActivePromotions` already degrades to an
 * empty list when the backend denies the read, so customers simply see no
 * promotional copy instead of an error.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ businessUnitId: string }> },
) {
  const { businessUnitId } = await ctx.params
  // Validate before it reaches serverFetch's URL building — this route has
  // no auth gate, so an unvalidated id is directly attacker-controlled.
  // Empty list (not 400) keeps the "decorative, degrade gracefully" contract.
  if (!z.string().uuid().safeParse(businessUnitId).success) {
    return NextResponse.json({ data: [] })
  }
  const data = await listActivePromotions(businessUnitId)
  return NextResponse.json({ data })
}
