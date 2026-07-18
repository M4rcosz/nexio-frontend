import { NextResponse } from 'next/server'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { cancelOrder } from '@/lib/api/orders'
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
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (
      code === 'cancel_window_closed' ||
      (err instanceof ApiError && err.status === 422)
    ) {
      return NextResponse.json(
        {
          error: 'This order is past the cancellation window.',
          code: 'cancel_window_closed',
        },
        { status: 422 },
      )
    }
    // Propagate the backend status (401/403 included) instead of masking it as
    // a 500, so the client can distinguish a dead session from a server error.
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
