import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { ApiError, describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

const MoneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format.')

// Mirrors the backend CreateOrderDto for the WEB channel (customer checkout).
const Body = z.object({
  businessUnitId: z.string().min(1),
  orderChannel: z.literal('WEB'),
  pointsRedeemed: z.number().int().min(0).optional(),
  orderItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        unitPrice: MoneyString,
        notes: z.string().max(150).nullish().transform((v) => v ?? undefined),
      }),
    )
    .min(1, 'Add at least one item to the order.'),
  notes: z.string().max(150).nullish().transform((v) => v ?? undefined),
})

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: err instanceof z.ZodError ? err.flatten() : undefined },
      { status: 400 },
    )
  }
  // Forward the client idempotency key (or mint one) so backend retries of
  // the same order don't duplicate it.
  const idempotencyKey =
    req.headers.get('idempotency-key') ?? crypto.randomUUID()
  try {
    const order = await createOrder(parsed, { idempotencyKey })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 422) {
      return NextResponse.json(
        { error: 'The order could not be created. Review the items and try again.' },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  try {
    const data = await listMyOrders()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
