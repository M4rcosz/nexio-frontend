import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

const Body = z.object({
  businessUnitId: z.string().min(1),
  orderChannel: z.literal('WEB'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().nullish().transform((v) => v ?? undefined),
      }),
    )
    .min(1, 'Add at least one item to the order.'),
  notes: z.string().nullish().transform((v) => v ?? undefined),
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
  try {
    const order = await createOrder(parsed)
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
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
