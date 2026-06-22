import { NextResponse } from 'next/server'
import { listProducts } from '@/lib/api/products'
import { describeError } from '@/lib/api/errors'

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
