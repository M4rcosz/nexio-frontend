import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createOrder, listMyOrders } from '@/lib/api/orders'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getSession, hasActiveOrRefreshableSession } from '@/lib/auth/session'
import {
  getChannelPolicy,
  nameRequired,
  requiresStaffActor,
} from '@/lib/orders/channelPolicy'
import { checkCustomerName } from '@/lib/validation/customerName'
import type { OrderChannel, OrderStatus } from '@/lib/api/types'

/**
 * Roles allowed to place a staff-actor (COUNTER/PICKUP) order in person
 * (doc §1/§2). KITCHEN is staff but does not serve customers, so it is
 * excluded — mirroring who the doc lists as serving the counter/pickup.
 */
const POS_ACTOR_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT']

/**
 * Whether a 422 from order creation is a stock shortfall.
 *
 * The backend sends no machine code for this — only prose ("Not enough stock
 * of product <id> at this business unit.") — so matching the text is the only
 * signal available. Deliberately loose, and only ever used to *add* a code:
 * if the wording drifts we fall back to the generic message rather than
 * mislabelling some other 422. Drop this the moment the backend sends a code.
 */
function isInsufficientStock(err: ApiError): boolean {
  // `err.message` already mirrors `body.message` for a JSON error body, but a
  // non-JSON 422 leaves the prose in `body` as a raw string and `message` as
  // "HTTP error 422" — so both shapes are checked.
  const fromBody =
    typeof err.body === 'string'
      ? err.body
      : typeof err.body === 'object' &&
          err.body !== null &&
          'message' in err.body &&
          typeof (err.body as { message: unknown }).message === 'string'
        ? (err.body as { message: string }).message
        : ''
  return /not enough stock/i.test(`${fromBody} ${err.message}`)
}

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

/**
 * Mirrors the backend CreateOrderDto. A single schema keyed off `orderChannel`
 * with a policy-driven refinement (rather than a per-channel object) so the
 * channel rules live in exactly one place — the {@link getChannelPolicy} table
 * (doc §3). The refinement enforces, per channel:
 *   - never `customerId` and `customerName` together (any channel);
 *   - APP/WEB reject both (identity is the JWT);
 *   - TOTEM requires a valid `customerName`;
 *   - COUNTER/PICKUP require exactly one of `customerId` / `customerName`.
 */
const Body = z
  .object({
    businessUnitId: z.string().uuid(),
    orderChannel: z.enum(['APP', 'WEB', 'TOTEM', 'COUNTER', 'PICKUP']),
    customerId: z.string().uuid().optional(),
    // Format is validated in the refinement (channel decides if it is even
    // allowed); here we only bound the raw length defensively.
    customerName: z.string().max(255).optional(),
    pointsRedeemed: z.number().int().min(0).optional(),
    orderItems: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
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
  .superRefine((val, ctx) => {
    const policy = getChannelPolicy(val.orderChannel)
    const hasId = val.customerId !== undefined
    const hasName =
      val.customerName !== undefined && val.customerName.trim() !== ''

    // Hard constraint on every channel (also enforced by a backend DB rule).
    if (hasId && hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerName'],
        message: 'both_customer_fields',
      })
      return
    }
    if (policy.nameRejected && hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerName'],
        message: 'name_rejected',
      })
    }
    if (!policy.allowsCustomerId && hasId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerId'],
        message: 'customer_id_not_allowed',
      })
    }
    // A name is required (TOTEM always, COUNTER/PICKUP walk-in) or, when
    // provided where allowed, must still be well-formed.
    if (nameRequired(val.orderChannel, hasId) || hasName) {
      const rule = checkCustomerName(val.customerName ?? '')
      if (rule) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerName'],
          message: rule === 'too-long' ? 'name_too_long' : 'name_required',
        })
      }
    }
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
  // Defense-in-depth on top of the backend's own gate: a COUNTER/PICKUP order
  // requires a staff attendant to place it (doc §2/§3), so fail fast here for a
  // request we already know is disallowed. APP/WEB/TOTEM never reach this branch
  // (they don't require a staff actor); their `customerId` is already rejected
  // at the schema level (allowsCustomerId=false → customer_id_not_allowed), so
  // no non-staff actor can smuggle another customer's id. When the session is
  // currently unreadable (expired but refreshable), we defer to the backend
  // rather than block a legitimate retry.
  if (requiresStaffActor(parsed.orderChannel)) {
    const session = await getSession()
    if (session && !POS_ACTOR_ROLES.includes(session.role)) {
      return NextResponse.json(
        {
          error: 'Only staff can place counter or pickup orders.',
          code: 'forbidden',
        },
        { status: 403 },
      )
    }
  }
  // Forward the client idempotency key (or mint one) so backend retries of
  // the same order don't duplicate it.
  const idempotencyKey =
    req.headers.get('idempotency-key') ?? crypto.randomUUID()
  // Send the trimmed name (and drop an empty one) so what we hash for
  // idempotency matches what the backend stores.
  const body = {
    ...parsed,
    customerName: parsed.customerName?.trim() || undefined,
  }
  try {
    const order = await createOrder(body, { idempotencyKey })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      // The backend folds several distinct refusals into 422, and the most
      // common one by far is a stock shortfall. Left untagged it reached the
      // user as "review the items and try again", which names neither the
      // cause nor a fix — the attendant re-clicks Place order and it fails
      // again. Sniff the shortfall out and give the client a stable code to
      // translate; the raw backend text is never forwarded (it carries the
      // internal product id, and may not be in the user's language).
      const code = isInsufficientStock(err) ? 'insufficient_stock' : undefined
      return NextResponse.json(
        {
          error:
            'The order could not be created. Review the items and try again.',
          ...(code ? { code } : {}),
        },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
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
    if (err instanceof ApiError && err.status === 403) {
      return NextResponse.json(
        { error: 'Only customers can list their orders.', code: 'forbidden' },
        { status: 403 },
      )
    }
    // The cursor is an opaque keyset token; stale or malformed, it comes back
    // 422. Tag it so the client restarts from page 1 rather than retrying a
    // token that can only ever fail again.
    if (err instanceof ApiError && err.status === 422) {
      return NextResponse.json(
        {
          error: 'The list changed. Reset to the first page.',
          code: 'invalid_cursor',
        },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
