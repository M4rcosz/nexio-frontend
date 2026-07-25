import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { confirmProductImage } from '@/lib/api/products'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { PRODUCT_IMAGE_PATH_MAX_LENGTH } from '@/lib/validation/constants'

/**
 * Step 3 of the product-image upload: publish the object the browser just PUT
 * to storage. ADMIN and MANAGER, matching `/image/upload-url`.
 *
 * `path` is opaque and echoed back verbatim from the mint — the client must
 * not build it, and neither does this handler. The backend re-parses it
 * against the product, so a path belonging to another product is a `422` there
 * rather than something to guess at here.
 */
const Body = z
  .object({ path: z.string().min(1).max(PRODUCT_IMAGE_PATH_MAX_LENGTH) })
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
    const product = await confirmProductImage(productId, parsed.path)
    // This is the call that mutates the row, so it owns the invalidation.
    // `products` + `product:<id>` cover the admin table and the detail page.
    //
    // `menu` is the third one and it is not optional: `PublicMenuItem` carries
    // `imageUrl` too, so the customer menu, POS and totem all render this
    // image from `menu:<businessUnitId>`-tagged fetches. Confirm deletes the
    // object it replaced, so a stale menu cache doesn't serve an old image —
    // it serves a URL to bytes that no longer exist. We can't know which units
    // carry this product from here, hence the coarse tag.
    revalidateTag('products')
    revalidateTag(`product:${productId}`)
    revalidateTag('menu')
    return NextResponse.json(product)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    // The two failure modes the uploader recovers from differently: a 404 means
    // the object is not there (upload never landed, or the credential expired
    // mid-upload) and the fix is a fresh mint; a 422 means the bytes were
    // rejected and the fix is a different file.
    if (status === 404) {
      return NextResponse.json(
        { error: 'Upload did not complete.', code: 'upload_incomplete' },
        { status: 404 },
      )
    }
    if (status === 422) {
      return NextResponse.json(
        { error: 'File rejected.', code: 'image_rejected' },
        { status: 422 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
