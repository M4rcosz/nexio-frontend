import { NextResponse } from 'next/server'
import { cancelOrder } from '@/lib/api/orders'
import { ApiError, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const order = await cancelOrder(id)
    if (!order)
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    return NextResponse.json(order)
  } catch (err) {
    // Propagate the backend status (401/403 included) instead of masking it as
    // a 500, so the client can distinguish a dead session from a server error.
    const status = err instanceof ApiError ? err.status || 500 : 500
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
