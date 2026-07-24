import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listActivePromotions } from '@/lib/api/promotions'

/**
 * Browser-facing proxy for the backend's public promotions listing
 * (`GET /promotions/public/by-business-unit/:id`) — consumed by the checkout
 * estimate. No role and no session: the upstream route is public and ignores an
 * Authorization header, and `listActivePromotions` degrades to an empty list on
 * any failure, so customers simply see no promotional copy instead of an error.
 */
// Short shared-cache TTL so the CDN/browser absorbs repeat hits for the same
// unit instead of every one becoming a fresh upstream round-trip. The upstream
// throttle counts per IP and this proxy fronts it from a single IP, so without
// this a burst of requests could exhaust the app-wide quota and blank every
// customer's promo banner. `stale-while-revalidate` keeps banners warm across
// the refresh. Applied to the empty/invalid case too, so a flood of bogus ids
// is dampened rather than hitting the origin each time.
const CACHE_HEADER = 'public, s-maxage=30, stale-while-revalidate=30'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ businessUnitId: string }> },
) {
  const { businessUnitId } = await ctx.params
  // Validate before it reaches the fetch's URL building — this route has no
  // auth gate, so an unvalidated id is directly attacker-controlled. Upstream
  // answers a malformed id with 400; an empty list keeps the "decorative,
  // degrade gracefully" contract this proxy promises its callers.
  if (!z.string().uuid().safeParse(businessUnitId).success) {
    return NextResponse.json(
      { data: [] },
      { headers: { 'Cache-Control': CACHE_HEADER } },
    )
  }
  const data = await listActivePromotions(businessUnitId)
  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': CACHE_HEADER } },
  )
}
