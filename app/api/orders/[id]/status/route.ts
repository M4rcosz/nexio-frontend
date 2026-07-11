import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateOrderStatus } from '@/lib/api/orders'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getSession } from '@/lib/auth/session'

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN']

const Body = z.object({
  orderStatus: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'DELIVERED',
    'CANCELLED',
  ]),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || !STAFF_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
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
    const order = await updateOrderStatus(id, parsed.orderStatus)
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (
      code === 'invalid_transition' ||
      (err instanceof ApiError && err.status === 422)
    ) {
      return NextResponse.json(
        {
          error: 'This status transition is not allowed.',
          code: 'invalid_transition',
        },
        { status: 422 },
      )
    }
    // Propagate a genuine upstream 4xx (e.g. a 403 the actor isn't allowed) and
    // collapse 5xx/unknown into 502 — matching the sibling order handlers rather
    // than masking everything as a 500.
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
