'use client'

import { useEffect, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Link, useRouter } from '@/i18n/navigation'
import { cartTotal, useCartStore } from '@/lib/cart/store'
import { useIdempotencyKey } from '@/lib/orders/idempotency'
import { formatMoney, multiplyMoney } from '@/lib/money'
import { bestPromotion, nextPromotionNudge } from '@/lib/promotions'
import { useDiscountLabel } from '@/lib/hooks/usePromotionLabel'
import type { Order, PublicPromotion } from '@/lib/api/types'

export function CheckoutView() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const businessUnitId = useCartStore((s) => s.businessUnitId)
  const businessUnitName = useCartStore((s) => s.businessUnitName)
  const clear = useCartStore((s) => s.clear)
  const [orderNotes, setOrderNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const discountLabel = useDiscountLabel()

  // Live promotions inform the estimate only — the backend owns the actual
  // discount (applied into the order's totalAmount), and applies at most one
  // per order. Fetched once per unit, never polled: the listing is public and
  // therefore throttled per IP. Any failure here just means no promotional copy.
  useEffect(() => {
    if (!businessUnitId) return
    let cancelled = false
    fetch(`/api/promotions/active/${businessUnitId}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: unknown } | null) => {
        if (cancelled || !Array.isArray(body?.data)) return
        setPromotions(body.data as PublicPromotion[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [businessUnitId])
  const t = useTranslations('checkout')
  const errorMessage = useErrorMessage()
  const tCommon = useTranslations('common')
  const locale = useLocale()

  // The exact body we POST. A stable idempotency key is derived from it, so
  // retries of the same submission return the original order (backend §4) while
  // an edited cart gets a fresh key. Built before the early returns to keep the
  // hook order stable.
  const orderPayload = {
    businessUnitId,
    orderChannel: 'WEB' as const,
    notes: orderNotes || undefined,
    orderItems: items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes || undefined,
    })),
  }
  const idempotencyKey = useIdempotencyKey(orderPayload)

  if (!hydrated) {
    return (
      <div className="card p-12 text-center text-sm text-fg-muted">
        {tCommon('loading')}
      </div>
    )
  }

  if (items.length === 0 || !businessUnitId) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🍽️
        </span>
        <p className="text-fg-muted">{t('emptyCart')}</p>
        <Link href="/" className="btn-primary mt-2">
          {t('browseUnits')}
        </Link>
      </div>
    )
  }

  const subtotal = cartTotal(items)
  const applied = bestPromotion(promotions, subtotal)
  const nudge = applied ? null : nextPromotionNudge(promotions, subtotal)
  const total = applied ? subtotal.minus(applied.discount) : subtotal

  function submit() {
    setError(null)
    start(async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Retries of this exact submission return the same order instead of
          // duplicating it (backend idempotency).
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(orderPayload),
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?redirect=/checkout')
          return
        }
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('submitFailed'))
        return
      }
      const order = (await res.json()) as Order
      clear()
      router.push(`/payment/${order.id}`)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <section className="card p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('unitTitle')}
          </p>
          <p className="mt-2 text-base font-semibold text-fg">
            {businessUnitName}
          </p>
        </section>

        <section className="card p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('itemsTitle')}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {items.map((i) => (
              <li
                key={i.productId}
                className="flex items-start justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-fg">
                    <span className="font-mono text-xs text-fg-subtle">
                      {i.quantity}×
                    </span>{' '}
                    {i.name}
                  </p>
                  {i.notes ? (
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {t('noteWith', { value: i.notes })}
                    </p>
                  ) : null}
                </div>
                <span className="font-semibold text-fg">
                  {formatMoney(multiplyMoney(i.unitPrice, i.quantity), locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <label className="label" htmlFor="notes">
            {t('notesLabel')}
          </label>
          <textarea
            id="notes"
            className="input min-h-[88px]"
            placeholder={t('notesPlaceholder')}
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
          />
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
          >
            {error}
          </p>
        ) : null}
      </div>

      <aside className="card sticky top-24 h-max overflow-hidden p-0">
        <div className="border-b border-border p-5" aria-live="polite">
          {applied ? (
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-fg-muted">{t('subtotal')}</dt>
                <dd className="text-fg">{formatMoney(subtotal, locale)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-forest-700 dark:text-forest-300">
                  {t('promoDiscount', { name: applied.promotion.name })}
                </dt>
                <dd className="text-forest-700 dark:text-forest-300">
                  −{formatMoney(applied.discount, locale)}
                </dd>
              </div>
            </dl>
          ) : null}
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {applied ? t('estimatedTotal') : t('total')}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-gradient-brand">
            {formatMoney(total, locale)}
          </p>
          {applied ? (
            <p className="mt-2 text-xs text-fg-subtle">
              {t('promoEstimateNote')}
            </p>
          ) : null}
          {nudge ? (
            <p className="mt-2 rounded-xl border border-brand-500/30 bg-brand-500/5 p-2.5 text-xs text-fg-muted">
              <span aria-hidden="true">🏷️</span>{' '}
              {t('promoNudge', {
                missing: formatMoney(nudge.missing, locale),
                name: nudge.promotion.name,
                label: discountLabel(nudge.promotion),
              })}
            </p>
          ) : null}
        </div>
        <div className="space-y-3 p-5">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="btn-primary w-full"
          >
            {pending ? t('submitting') : t('submit')}
          </button>
          <p className="text-xs text-fg-subtle">{t('paymentNext')}</p>
        </div>
      </aside>
    </div>
  )
}
