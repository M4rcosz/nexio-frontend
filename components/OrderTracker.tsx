'use client'

import { useEffect, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { ORDER_STATUS_TIMELINE } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Order, OrderStatus } from '@/lib/api/types'

const POLL_INTERVAL_MS = 5000

export function OrderTracker({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState<Order>(initialOrder)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('order')
  const errorMessage = useErrorMessage()
  const locale = useLocale()

  useEffect(() => {
    if (
      order.orderStatus === 'DELIVERED' ||
      order.orderStatus === 'CANCELLED'
    ) {
      return
    }
    let cancelled = false
    const interval = setInterval(async () => {
      const res = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' })
      if (!res.ok || cancelled) return
      setOrder((await res.json()) as Order)
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [order.id, order.orderStatus])

  function cancel() {
    setError(null)
    start(async () => {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null
        setError(errorMessage(body?.code, res.status) ?? t('cancelFailed'))
        return
      }
      setOrder((await res.json()) as Order)
    })
  }

  const canCancel =
    order.orderStatus !== 'DELIVERED' &&
    order.orderStatus !== 'CANCELLED' &&
    order.orderStatus !== 'READY'

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('statusTitle')}
          </p>
          {order.orderStatus !== 'CANCELLED' &&
          order.orderStatus !== 'DELIVERED' ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              live
            </span>
          ) : null}
        </div>
        <Timeline current={order.orderStatus} />
        {order.orderStatus === 'CANCELLED' ? (
          <p className="mt-4 rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
            {t('cancelled')}
          </p>
        ) : null}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('itemsTitle')}
          </p>
        </div>
        <ul className="divide-y divide-border">
          {order.orderItems.map((item, idx) => (
            <li
              key={`${item.productId}-${idx}`}
              className="flex justify-between px-5 py-3 text-sm"
            >
              <span className="text-fg">
                <span className="font-mono text-xs text-fg-subtle">
                  {item.quantity}×
                </span>{' '}
                {item.productName ?? item.productId}
              </span>
              <span className="font-semibold text-fg">
                {formatMoney(item.subtotal, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-border bg-surface-2 px-5 py-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('total')}
          </span>
          <span className="font-display text-2xl font-bold text-gradient-brand">
            {formatMoney(order.totalAmount, locale)}
          </span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
          {error}
        </p>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="btn-danger"
        >
          {pending ? t('cancelling') : t('cancel')}
        </button>
      ) : null}
    </div>
  )
}

function Timeline({ current }: { current: OrderStatus }) {
  const t = useTranslations('orderStatus')
  const tOrder = useTranslations('order')

  if (current === 'CANCELLED') {
    return (
      <p className="mt-4 text-sm text-accent-600 dark:text-accent-400">
        {tOrder('cancelledMessage')}
      </p>
    )
  }
  const idx = ORDER_STATUS_TIMELINE.indexOf(current)
  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-5">
      {ORDER_STATUS_TIMELINE.map((status, i) => {
        const passed = i <= idx
        const isCurrent = i === idx
        return (
          <li
            key={status}
            className={`relative flex flex-col gap-1 rounded-xl border p-3 text-xs transition-colors ${
              passed
                ? 'border-brand-500/40 bg-brand-gradient text-white shadow-soft'
                : 'border-border bg-surface text-fg-muted'
            } ${isCurrent ? 'ring-2 ring-brand-500/40' : ''}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-90">
              0{i + 1}
            </span>
            <span className="font-semibold leading-tight">{t(status)}</span>
            {isCurrent ? (
              <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-white/80" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
