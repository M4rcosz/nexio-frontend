import { NextResponse } from 'next/server'
import { z } from 'zod'
import { mintProductImageUploadUrl } from '@/lib/api/products'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { PRODUCT_IMAGE_CONTENT_TYPES } from '@/lib/validation/constants'

/**
 * Step 1 of the product-image upload: mint a signed storage credential.
 *
 * ADMIN **and** MANAGER, unlike `PATCH /api/products/:productId` next door,
 * which is ADMIN-only. A MANAGER may therefore replace a product image but not
 * clear one — see the note in `ProductImageManager`.
 *
 * Nothing is persisted here, so there is no cache to invalidate: the product
 * row only changes at `/image/confirm`.
 */
const Body = z
  .object({ contentType: z.enum(PRODUCT_IMAGE_CONTENT_TYPES) })
  .strict()

export async function POST(
  req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }

  const { productId } = await ctx.params
  // Validate the id before it is concatenated into the backend URL — guards
  // against path/query injection through serverFetch's URL building.
  if (!z.string().uuid().safeParse(productId).success) {
    return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 })
  }

  const raw = await req.json().catch(() => null)
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(raw)
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
    const minted = await mintProductImageUploadUrl(
      productId,
      parsed.contentType,
    )
    // `no-store`: the body carries a live write credential for the bucket.
    return NextResponse.json(minted, {
      status: 201,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    // 429 is the mint budget (10/minute per client), not a generic failure —
    // forward it verbatim so the uploader can say "slow down" rather than
    // "try again", which would spend the remaining budget faster.
    if (status === 429) {
      return NextResponse.json(
        { error: 'Too many upload attempts.', code: 'rate_limited' },
        { status: 429 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
