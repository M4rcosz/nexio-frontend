import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createPayment, getOrderPayment } from '@/lib/api/payments'
import { getOrder } from '@/lib/api/orders'
import { ApiError, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'

const Body = z.object({
  method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'CASH', 'VOUCHER']),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
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
    // The mock needs the order total; the real backend derives it itself.
    const order = await getOrder(id)
    if (!order)
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    const payment = await createPayment(
      { orderId: id, method: parsed.method },
      order.totalAmount,
    )
    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 422) {
      return NextResponse.json(
        { error: 'This order is not awaiting payment.', code: 'not_payable' },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const payment = await getOrderPayment(id)
    if (!payment)
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    return NextResponse.json(payment)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
