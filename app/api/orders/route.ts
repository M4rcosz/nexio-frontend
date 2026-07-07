import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { ApiError, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import type { OrderChannel, OrderStatus } from '@/lib/api/types'

const ORDER_CHANNELS: OrderChannel[] = [
  'APP',
  'WEB',
  'TOTEM',
  'COUNTER',
  'PICKUP',
]
const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]

const MoneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format.')

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
        notes: z
          .string()
          .max(150)
          .nullish()
          .transform((v) => v ?? undefined),
      }),
    )
    .min(1, 'Add at least one item to the order.'),
  notes: z
    .string()
    .max(150)
    .nullish()
    .transform((v) => v ?? undefined),
})

export async function POST(req: Request) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
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
        {
          error:
            'The order could not be created. Review the items and try again.',
        },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}

export async function GET(req: Request) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const url = new URL(req.url)
  const limitRaw = url.searchParams.get('limit')
  const cursor = url.searchParams.get('cursor') ?? undefined
  const channelRaw = url.searchParams.get('orderChannel')
  const statusRaw = url.searchParams.get('orderStatus')

  // Silently drop unknown enum values rather than 400 — the filter simply
  // doesn't apply. Only the canonical values reach the backend.
  const orderChannel = ORDER_CHANNELS.includes(channelRaw as OrderChannel)
    ? (channelRaw as OrderChannel)
    : undefined
  const orderStatus = ORDER_STATUSES.includes(statusRaw as OrderStatus)
    ? (statusRaw as OrderStatus)
    : undefined
  // Contract: 1..100, integer, default 20. Truncate to drop fractional
  // values ("20.5" → 20) rather than forwarding them to the backend.
  const limitNum = Number(limitRaw)
  const limit =
    limitRaw && Number.isFinite(limitNum)
      ? Math.min(Math.max(Math.trunc(limitNum), 1), 100)
      : 20

  try {
    const data = await listMyOrders({
      limit,
      cursor,
      orderChannel,
      orderStatus,
    })
    return NextResponse.json(data)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 403) {
      return NextResponse.json(
        { error: 'Only customers can list their orders.', code: 'forbidden' },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
