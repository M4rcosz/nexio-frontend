import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createPayment, getPayment } from '@/lib/api/payments'
import { getOrder } from '@/lib/api/orders'
import { describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

const Body = z.object({
  method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'CASH', 'VOUCHER']),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: err instanceof z.ZodError ? err.flatten() : undefined },
      { status: 400 },
    )
  }
  try {
    const order = await getOrder(id)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    const payment = await createPayment(id, order.totalAmount, parsed)
    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const payment = await getPayment(id)
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    return NextResponse.json(payment)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
