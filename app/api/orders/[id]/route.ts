import { NextResponse } from 'next/server'
import { getOrder } from '@/lib/api/orders'
import { ApiError, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const order = await getOrder(id)
    if (!order)
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    return NextResponse.json(order)
  } catch (err) {
    // Propagate the backend status (e.g. a 401 the self-heal couldn't recover)
    // so the polling client can tell an auth failure from a server error.
    const status = err instanceof ApiError ? err.status || 500 : 500
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
