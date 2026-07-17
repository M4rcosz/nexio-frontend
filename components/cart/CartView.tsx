'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cartTotal, useCartStore } from '@/lib/cart/store'
import { formatMoney, multiplyMoney } from '@/lib/money'

export function CartView() {
  const items = useCartStore((s) => s.items)
  const businessUnitName = useCartStore((s) => s.businessUnitName)
  const businessUnitId = useCartStore((s) => s.businessUnitId)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const setNotes = useCartStore((s) => s.setNotes)
  const clear = useCartStore((s) => s.clear)
  const t = useTranslations('cart')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  if (!hydrated) {
    return (
      <div className="card p-12 text-center text-sm text-fg-muted">
        {tCommon('loading')}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🛒
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
        <Link href="/" className="btn-primary mt-2">
          {t('browseUnits')}
        </Link>
      </div>
    )
  }

  const total = cartTotal(items)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="card flex items-center justify-between p-4 text-sm">
          <span className="text-fg-muted">
            {t('orderingFrom', {
              unit: businessUnitName ?? t('orderingFromUnknown'),
            })}
          </span>
          {businessUnitId ? (
            <Link
              href={`/units/${businessUnitId}`}
              className="font-medium text-brand-500 hover:text-brand-600"
            >
              {t('backToMenu')} →
            </Link>
          ) : null}
        </div>

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.productId} className="card card-hover flex gap-4 p-4">
              <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-xl bg-brand-soft text-3xl">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  '🍲'
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold tracking-tight text-fg">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {formatMoney(item.unitPrice, locale)} ·{' '}
                      <span className="font-semibold text-brand-600 dark:text-brand-300">
                        {formatMoney(
                          multiplyMoney(item.unitPrice, item.quantity),
                          locale,
                        )}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="rounded-lg p-1 text-fg-subtle transition-colors hover:bg-accent-500/10 hover:text-accent-600"
                    aria-label={tCommon('remove')}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(item.productId, item.quantity - 1)
                      }
                      className="px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      aria-label="−"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(item.productId, item.quantity + 1)
                      }
                      className="px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      aria-label="+"
                    >
                      +
                    </button>
                  </div>
                  <input
                    placeholder={t('notesPlaceholder')}
                    className="input flex-1 !py-1.5 text-xs"
                    value={item.notes ?? ''}
                    onChange={(e) => setNotes(item.productId, e.target.value)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={clear}
          className="btn-ghost w-full !justify-start text-xs"
        >
          {t('clear')}
        </button>
      </div>

      <aside className="card sticky top-24 h-max overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('summary')}
          </p>
          <p className="mt-2 text-xs text-fg-muted">
            {t('items')}:{' '}
            <span className="font-semibold text-fg">
              {items.reduce((a, i) => a + i.quantity, 0)}
            </span>
          </p>
          <p className="mt-4 font-display text-3xl font-bold text-gradient-brand">
            {formatMoney(total, locale)}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-fg-subtle">
            {t('total')}
          </p>
        </div>
        <div className="p-5">
          <Link href="/checkout" className="btn-primary w-full">
            {t('checkout')}
          </Link>
        </div>
      </aside>
    </div>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
