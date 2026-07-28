'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Select } from '@/components/ui/Select'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { clientFetch } from '@/lib/api/client'
import { formatMoney } from '@/lib/money'
import { dayKey, formatDateLabel, formatTime } from '@/lib/format'
import type {
  Order,
  OrderChannel,
  OrderStatus,
  Paginated,
} from '@/lib/api/types'

/** How many items a collapsed order card lists before the expand toggle. */
const ITEMS_PREVIEW = 3

const CHANNELS: OrderChannel[] = ['APP', 'WEB', 'TOTEM', 'COUNTER', 'PICKUP']
const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]

type Meta = Paginated<Order>['meta']

/** Merge a new page into the current list, dropping ids already present. */
function mergeUnique(current: Order[], incoming: Order[]): Order[] {
  const seen = new Set(current.map((o) => o.id))
  const next = [...current]
  for (const o of incoming) {
    if (!seen.has(o.id)) {
      seen.add(o.id)
      next.push(o)
    }
  }
  return next
}

type DayGroup = { key: string; orders: Order[] }

/**
 * Split an already createdAt-desc list into consecutive same-day runs — the
 * rows of the timeline. Consecutive (rather than a keyed bucket) keeps the
 * backend's ordering intact even if a page ever arrives out of order.
 */
function groupByDay(orders: Order[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const order of orders) {
    const key = dayKey(order.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.orders.push(order)
    else groups.push({ key, orders: [order] })
  }
  return groups
}

export function MyOrdersList({ initial }: { initial: Paginated<Order> }) {
  const t = useTranslations('orders')
  const tStatus = useTranslations('orderStatus')
  const tChannel = useTranslations('orderChannel')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [orders, setOrders] = useState<Order[]>(initial.data)
  const [meta, setMeta] = useState<Meta>(initial.meta)
  const [channel, setChannel] = useState<OrderChannel | ''>('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // A failed filter reload keeps the previous list on screen so a transient
  // error never masquerades as an empty "no orders match" result.
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  // Guards against a stale response overwriting a newer filter selection.
  const requestId = useRef(0)

  const fetchPage = useCallback(
    async (
      filters: { channel: OrderChannel | ''; status: OrderStatus | '' },
      cursor?: string,
    ) => {
      return clientFetch<Paginated<Order>>('/api/orders', {
        query: {
          limit: 20,
          cursor,
          orderChannel: filters.channel || undefined,
          orderStatus: filters.status || undefined,
        },
      })
    },
    [],
  )

  // Load the first page under the current filters, replacing the list on
  // success and surfacing a retryable error on failure (the previous list stays
  // put so a flaky request can't read as "no orders match").
  const loadFirstPage = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    setLoadMoreError(null)
    fetchPage({ channel, status })
      .then((page) => {
        if (id !== requestId.current) return
        setOrders(page.data)
        setMeta(page.meta)
      })
      .catch((err) => {
        if (id !== requestId.current) return
        setError(
          errorMessage(
            (err as { code?: string })?.code,
            (err as { status?: number })?.status,
          ) ?? t('loadError'),
        )
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [channel, status, fetchPage, errorMessage, t])

  // Latest loader, so the reload effect can key off the filters alone.
  // `errorMessage`/`t` hand back a fresh closure each render, so depending on
  // `loadFirstPage` directly would refire this on *every* render and reset the
  // list to page one — wiping any appended pages.
  const loadRef = useRef(loadFirstPage)
  loadRef.current = loadFirstPage

  // Reload whenever a filter changes (skips the initial mount, which already
  // holds the server-rendered first page).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    loadRef.current()
  }, [channel, status])

  async function loadMore() {
    if (!meta.hasMore || !meta.nextCursor || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const page = await fetchPage({ channel, status }, meta.nextCursor)
      if (id !== requestId.current) return
      // Backend already orders createdAt desc — just append and dedupe.
      setOrders((cur) => mergeUnique(cur, page.data))
      setMeta(page.meta)
    } catch (err) {
      if (id !== requestId.current) return
      // 422 means the keyset cursor went stale — the list moved underneath us.
      // The token is unrecoverable but the listing is not: restart from page 1
      // under the current filters. Retrying the dead cursor fails identically.
      if ((err as { status?: number })?.status === 422) {
        try {
          const page = await fetchPage({ channel, status })
          if (id !== requestId.current) return
          setOrders(page.data)
          setMeta(page.meta)
        } catch (restartErr) {
          if (id !== requestId.current) return
          setLoadMoreError(
            errorMessage(
              (restartErr as { code?: string })?.code,
              (restartErr as { status?: number })?.status,
            ) ?? t('loadMoreError'),
          )
        }
        return
      }
      setLoadMoreError(
        errorMessage(
          (err as { code?: string })?.code,
          (err as { status?: number })?.status,
        ) ?? t('loadMoreError'),
      )
    } finally {
      setLoadingMore(false)
    }
  }

  const groups = useMemo(() => groupByDay(orders), [orders])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
            {t('filters.channel')}
          </span>
          <Select
            fullWidth={false}
            ariaLabel={t('filters.channel')}
            value={channel}
            onChange={(v) => setChannel(v as OrderChannel | '')}
            options={[
              { value: '', label: t('filters.allChannels') },
              ...CHANNELS.map((c) => ({ value: c, label: tChannel(c) })),
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
            {t('filters.status')}
          </span>
          <Select
            fullWidth={false}
            ariaLabel={t('filters.status')}
            value={status}
            onChange={(v) => setStatus(v as OrderStatus | '')}
            options={[
              { value: '', label: t('filters.allStatuses') },
              ...STATUSES.map((s) => ({ value: s, label: tStatus(s) })),
            ]}
          />
        </div>
      </div>

      {error && orders.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-500/40 bg-accent-500/10 px-4 py-3 text-sm text-accent-700 dark:text-accent-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadFirstPage}
            disabled={loading}
            className="btn-ghost shrink-0 disabled:opacity-50"
          >
            {t('retry')}
          </button>
        </div>
      ) : null}

      {error && orders.length === 0 ? (
        <div
          role="alert"
          className="card flex flex-col items-center gap-3 p-12 text-center"
        >
          <span className="text-5xl" aria-hidden>
            ⚠️
          </span>
          <p className="text-fg-muted">{error}</p>
          <button
            type="button"
            onClick={loadFirstPage}
            disabled={loading}
            className="btn-secondary disabled:opacity-50"
          >
            {t('retry')}
          </button>
        </div>
      ) : orders.length === 0 && !loading ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            📜
          </span>
          <p className="text-fg-muted">{t('noResults')}</p>
        </div>
      ) : (
        <div className={`relative max-w-3xl ${loading ? 'opacity-50' : ''}`}>
          {/* The rail runs behind every group; each dot punches a gap in it
              with a bg-coloured ring, so no negative offsets are involved. */}
          <span
            aria-hidden
            className="absolute bottom-2 left-1.5 top-2 w-px bg-border"
          />
          <ol className="space-y-8" aria-busy={loading}>
            {groups.map((group) => (
              <li key={group.key} className="relative pl-7 sm:pl-9">
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-bg"
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-base font-bold tracking-tight text-fg sm:text-lg">
                    {formatDateLabel(group.orders[0].createdAt, locale)}
                  </h2>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
                    {t('dayOrderCount', { count: group.orders.length })}
                  </span>
                </div>
                <ul className="mt-3 space-y-3">
                  {group.orders.map((order) => (
                    <li key={order.id}>
                      <OrderCard order={order} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      {meta.hasMore && meta.nextCursor ? (
        <div className="flex flex-col items-center gap-2">
          {loadMoreError ? (
            <p role="alert" className="text-xs text-accent-600">
              {loadMoreError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            aria-busy={loadingMore}
            className="btn-ghost"
          >
            {loadingMore ? t('loadingMore') : t('loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * One node of the timeline. The card body is a single link to the order, and
 * the expand toggle sits outside it — nesting a button inside an anchor is
 * invalid, and it also keeps a click on "see all items" from navigating away.
 */
function OrderCard({ order }: { order: Order }) {
  const t = useTranslations('orders')
  const tStatus = useTranslations('orderStatus')
  const tChannel = useTranslations('orderChannel')
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const itemsId = useId()

  const isOpen =
    order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED'
  const items = order.orderItems ?? []
  const collapsible = items.length > ITEMS_PREVIEW
  const shown = collapsible && !expanded ? items.slice(0, ITEMS_PREVIEW) : items

  return (
    <div className="card card-hover overflow-hidden">
      <Link href={`/orders/${order.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {formatTime(order.createdAt, locale)}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-fg-subtle">
              {order.id}
            </p>
          </div>
          {isOpen ? (
            <span className="chip-warn shrink-0">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" />
              {tStatus(order.orderStatus)}
            </span>
          ) : (
            <span className="chip shrink-0">{tStatus(order.orderStatus)}</span>
          )}
        </div>

        {items.length > 0 ? (
          <ul id={itemsId} className="mt-4 space-y-1.5">
            {shown.map((item, idx) => (
              <li
                key={item.id || `${item.productId}-${idx}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-fg-muted">
                  <span className="font-mono text-xs text-fg-subtle">
                    {item.quantity}×
                  </span>{' '}
                  {item.productName}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {formatMoney(item.subtotal, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-xs text-fg-muted">
            {tChannel(order.orderChannel)}
          </span>
          <span className="font-display text-xl font-bold text-gradient-brand">
            {formatMoney(order.totalAmount, locale)}
          </span>
        </div>
      </Link>

      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={itemsId}
          className="w-full border-t border-border px-5 py-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {expanded
            ? t('showFewerItems')
            : t('showAllItems', { count: items.length })}
        </button>
      ) : null}
    </div>
  )
}
