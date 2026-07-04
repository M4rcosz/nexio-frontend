'use client'

import { useEffect, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Link, useRouter } from '@/i18n/navigation'
import { cartTotal, useCartStore } from '@/lib/cart/store'
import { formatMoney, multiplyMoney } from '@/lib/money'
import type { Order } from '@/lib/api/types'

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
  const t = useTranslations('checkout')
  const errorMessage = useErrorMessage()
  const tCommon = useTranslations('common')
  const locale = useLocale()

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
        <span className="text-5xl" aria-hidden>🍽️</span>
        <p className="text-fg-muted">{t('emptyCart')}</p>
        <Link href="/" className="btn-primary mt-2">
          {t('browseUnits')}
        </Link>
      </div>
    )
  }

  const total = cartTotal(items)

  function submit() {
    setError(null)
    start(async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Retries of this exact submission return the same order instead of
          // duplicating it (backend idempotency).
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          businessUnitId,
          orderChannel: 'WEB',
          notes: orderNotes || undefined,
          orderItems: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            notes: i.notes || undefined,
          })),
        }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?redirect=/checkout')
          return
        }
        const body = (await res.json().catch(() => null)) as { code?: string } | null
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
          <p className="mt-2 text-base font-semibold text-fg">{businessUnitName}</p>
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
                    <span className="font-mono text-xs text-fg-subtle">{i.quantity}×</span>{' '}
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
          <label className="label" htmlFor="notes">{t('notesLabel')}</label>
          <textarea
            id="notes"
            className="input min-h-[88px]"
            placeholder={t('notesPlaceholder')}
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
          />
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
            {error}
          </p>
        ) : null}
      </div>

      <aside className="card sticky top-24 h-max overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('total')}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-gradient-brand">
            {formatMoney(total, locale)}
          </p>
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
