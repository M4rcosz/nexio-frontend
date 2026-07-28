import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { updateProduct } from '@/lib/api/products'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

// Positive decimal string with ≤2 places; "0"/"0.00" are rejected.
const MONEY = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')
  .refine((v) => Number(v) > 0, 'Must be greater than zero.')

// `.strict()` rejects unknown keys (isActive, id, createdAt, updatedAt, …) with
// a 400 — isActive is managed through the activate/deactivate routes instead.
const PatchBody = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().min(1).max(255).optional(),
    price: MONEY.optional(),
    categoryId: z.string().uuid().optional(),
    // `null` clears the image reference (the stored object is not deleted).
    // This is the only clear path: the upload/confirm pair can replace an image
    // but never remove one, which is why clearing is ADMIN-only while
    // uploading is ADMIN+MANAGER.
    imageUrl: z
      .union([
        z
          .string()
          .url()
          .max(2000)
          .refine(
            (v) => /^https?:\/\//i.test(v),
            'Only http(s) URLs are allowed.',
          ),
        z.null(),
      ])
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required.',
  })

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const admin = await getAdminContext()
  // Separated from the role check so an expired session reads as "log in
  // again" rather than "you may not do this". This is the image-clear path as
  // well as the edit path, and `useErrorMessage` keys off the status.
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  // ADMIN only: MANAGER may neither create nor edit catalog products.
  if (admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }
  const { productId } = await ctx.params
  // Validate the id before it is concatenated into the backend URL — guards
  // against path/query injection through serverFetch's URL building.
  if (!z.string().uuid().safeParse(productId).success) {
    return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 })
  }
  const raw = await req.json().catch(() => null)

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
    const product = await updateProduct(productId, parsed)
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    }
    // Bust the list cache, this product's detail cache, and the per-unit menus
    // — `PublicMenuItem` mirrors `name`/`imageUrl`, so a patch here (including
    // an `imageUrl: null` clear) is visible on the customer menu, POS and
    // totem. The coarse `menu` tag covers every unit, since this route has no
    // way to know which ones list the product.
    revalidateTag('products')
    revalidateTag(`product:${productId}`)
    revalidateTag('menu')
    return NextResponse.json(product)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        { error: 'Product name already in use.', code: 'name_taken' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
