import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createProduct, listProducts } from '@/lib/api/products'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

/**
 * Internal proxy used by the home product search box. Delegates to the real
 * `GET /api/products` backend endpoint (with cookie auth) via serverFetch, or
 * to the mock when NEXT_PUBLIC_USE_MOCKS is on.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? undefined
  const categoryId = url.searchParams.get('categoryId') ?? undefined
  try {
    const page = await listProducts({ search, categoryId, limit: 12 })
    return NextResponse.json(page)
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err), data: [] },
      { status: 200 },
    )
  }
}

// Positive decimal string with ≤2 places; "0"/"0.00" are rejected. Mirrors the
// MONEY validator on `PATCH /products/:productId`.
const MONEY = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string.')
  .refine((v) => Number(v) > 0, 'Must be greater than zero.')

// `.strict()` rejects unknown keys (isActive, id, createdAt, …) with a 400 —
// products are born active and `imageUrl` is required on create (unlike PATCH).
const CreateBody = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().min(1).max(255).optional(),
    price: MONEY,
    categoryId: z.string().uuid(),
    imageUrl: z
      .string()
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//i.test(v), 'Only http(s) URLs are allowed.'),
  })
  .strict()

export async function POST(req: Request) {
  const admin = await getAdminContext()
  // ADMIN only: MANAGER cannot create catalog products.
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

  const raw = await req.json().catch(() => null)

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

  try {
    const product = await createProduct(parsed)
    return NextResponse.json(product, { status: 201 })
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
