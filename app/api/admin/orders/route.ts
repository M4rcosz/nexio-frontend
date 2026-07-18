import { NextResponse } from 'next/server'
import { listOrders } from '@/lib/api/orders'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import type {
  OrderChannel,
  OrderSortField,
  OrderStatus,
  SortDirection,
} from '@/lib/api/types'

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
const SORT_FIELDS: OrderSortField[] = ['createdAt', 'totalAmount']
const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc']

const MoneyString = /^\d+(\.\d{1,2})?$/
const IsoInstant =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

/** The staff "order board": `GET /orders`, gated to ADMIN/MANAGER like the
 * rest of the admin area. ATTENDANT/KITCHEN can reach the underlying backend
 * route (see the /:id/status and /:id/cancel handlers), but have no
 * dashboard of their own yet — see lib/auth/landing.ts. */
export async function GET(req: Request) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const sp = url.searchParams

  const limitRaw = sp.get('limit')
  const limitNum = Number(limitRaw)
  // Contract: 1..100, integer, default 20. Truncate fractional values rather
  // than forwarding them.
  const limit =
    limitRaw && Number.isFinite(limitNum)
      ? Math.min(Math.max(Math.trunc(limitNum), 1), 100)
      : 20

  const channelRaw = sp.get('orderChannel')
  const statusRaw = sp.get('orderStatus')
  const sortByRaw = sp.get('sortBy')
  const sortDirRaw = sp.get('sortDir')
  const createdAtFromRaw = sp.get('createdAtFrom')
  const createdAtToRaw = sp.get('createdAtTo')
  const minTotalRaw = sp.get('minTotal')
  const maxTotalRaw = sp.get('maxTotal')

  try {
    const data = await listOrders({
      limit,
      // Opaque — never inspected, just relayed.
      cursor: sp.get('cursor') ?? undefined,
      businessUnitId: sp.get('businessUnitId') ?? undefined,
      orderChannel: ORDER_CHANNELS.includes(channelRaw as OrderChannel)
        ? (channelRaw as OrderChannel)
        : undefined,
      orderStatus: ORDER_STATUSES.includes(statusRaw as OrderStatus)
        ? (statusRaw as OrderStatus)
        : undefined,
      attendantId: sp.get('attendantId') ?? undefined,
      customerId: sp.get('customerId') ?? undefined,
      createdAtFrom:
        createdAtFromRaw && IsoInstant.test(createdAtFromRaw)
          ? createdAtFromRaw
          : undefined,
      createdAtTo:
        createdAtToRaw && IsoInstant.test(createdAtToRaw)
          ? createdAtToRaw
          : undefined,
      minTotal:
        minTotalRaw && MoneyString.test(minTotalRaw) ? minTotalRaw : undefined,
      maxTotal:
        maxTotalRaw && MoneyString.test(maxTotalRaw) ? maxTotalRaw : undefined,
      sortBy: SORT_FIELDS.includes(sortByRaw as OrderSortField)
        ? (sortByRaw as OrderSortField)
        : undefined,
      sortDir: SORT_DIRECTIONS.includes(sortDirRaw as SortDirection)
        ? (sortDirRaw as SortDirection)
        : undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    // A stale or sort-mismatched cursor: tell the client to reset to page 1
    // instead of collapsing it into a generic 5xx-shaped error.
    if (
      code === 'invalid_cursor' ||
      (err instanceof ApiError && err.status === 422)
    ) {
      return NextResponse.json(
        {
          error: 'This list changed. Reset to the first page.',
          code: 'invalid_cursor',
        },
        { status: 422 },
      )
    }
    if (err instanceof ApiError && err.status === 403) {
      return NextResponse.json(
        { error: 'Only staff can list the order board.', code: 'forbidden' },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
