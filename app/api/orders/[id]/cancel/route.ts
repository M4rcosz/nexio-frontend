import { NextResponse } from 'next/server'
import { cancelOrder } from '@/lib/api/orders'
import { describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const order = await cancelOrder(id)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    return NextResponse.json(order)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
