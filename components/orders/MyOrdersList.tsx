'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Select } from '@/components/ui/Select'
import { clientFetch } from '@/lib/api/client'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import type {
  Order,
  OrderChannel,
  OrderStatus,
  Paginated,
} from '@/lib/api/types'

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

export function MyOrdersList({ initial }: { initial: Paginated<Order> }) {
  const t = useTranslations('orders')
  const tStatus = useTranslations('orderStatus')
  const tChannel = useTranslations('orderChannel')
  const locale = useLocale()

  const [orders, setOrders] = useState<Order[]>(initial.data)
  const [meta, setMeta] = useState<Meta>(initial.meta)
  const [channel, setChannel] = useState<OrderChannel | ''>('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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

  // Reload the first page whenever a filter changes (skips the initial mount,
  // which already holds the server-rendered first page).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const id = ++requestId.current
    setLoading(true)
    fetchPage({ channel, status })
      .then((page) => {
        if (id !== requestId.current) return
        setOrders(page.data)
        setMeta(page.meta)
      })
      .catch(() => {
        if (id !== requestId.current) return
        setOrders([])
        setMeta({ limit: 20, nextCursor: null, hasMore: false })
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [channel, status, fetchPage])

  async function loadMore() {
    if (!meta.hasMore || !meta.nextCursor || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const page = await fetchPage({ channel, status }, meta.nextCursor)
      if (id !== requestId.current) return
      // Backend already orders createdAt desc — just append and dedupe.
      setOrders((cur) => mergeUnique(cur, page.data))
      setMeta(page.meta)
    } catch {
      // keep current list; the button stays available for a retry
    } finally {
      setLoadingMore(false)
    }
  }

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

      {orders.length === 0 && !loading ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            📜
          </span>
          <p className="text-fg-muted">{t('noResults')}</p>
        </div>
      ) : (
        <ul
          className={`grid gap-4 sm:grid-cols-2 ${loading ? 'opacity-50' : ''}`}
          aria-busy={loading}
        >
          {orders.map((order) => {
            const isOpen =
              order.orderStatus !== 'DELIVERED' &&
              order.orderStatus !== 'CANCELLED'
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="card card-hover block p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                        {formatDateTime(order.createdAt, locale)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-fg-subtle">
                        {order.id}
                      </p>
                    </div>
                    {isOpen ? (
                      <span className="chip-warn">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" />
                        {tStatus(order.orderStatus)}
                      </span>
                    ) : (
                      <span className="chip">{tStatus(order.orderStatus)}</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                    <span className="text-xs text-fg-muted">
                      {tChannel(order.orderChannel)}
                    </span>
                    <span className="font-display text-xl font-bold text-gradient-brand">
                      {formatMoney(order.totalAmount, locale)}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {meta.hasMore && meta.nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost"
          >
            {loadingMore ? t('loadingMore') : t('loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
