import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getCategory, updateCategory } from '@/lib/api/categories'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

// `.strict()` rejects unknown keys (id, createdAt, …) with a 400. isActive is a
// native boolean here — passing `false` soft-deletes the category.
const PatchBody = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required.',
  })

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await ctx.params
  // Validate the id before it is concatenated into the backend URL — guards
  // against path/query injection through serverFetch's URL building.
  if (!z.string().uuid().safeParse(categoryId).success) {
    return NextResponse.json({ error: 'Invalid category id.' }, { status: 400 })
  }
  try {
    const category = await getCategory(categoryId)
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json(category)
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return NextResponse.json(
        { error: describeError(err) },
        { status: err.status },
      )
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ categoryId: string }> },
) {
  const admin = await getAdminContext()
  // ADMIN only, mirroring products.
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }

  const { categoryId } = await ctx.params
  if (!z.string().uuid().safeParse(categoryId).success) {
    return NextResponse.json({ error: 'Invalid category id.' }, { status: 400 })
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
    const category = await updateCategory(categoryId, parsed)
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found.' },
        { status: 404 },
      )
    }
    revalidateTag('categories')
    revalidateTag(`category:${categoryId}`)
    return NextResponse.json(category)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        { error: 'Name already in use.', code: 'name_taken' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
