'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cartCount, cartTotal, useCartStore } from '@/lib/cart/store'
import { formatMoney, multiplyMoney } from '@/lib/money'
import { ProductImage } from '@/components/ui/ProductImage'

export function CartBadge() {
  const items = useCartStore((s) => s.items)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const t = useTranslations('cart')
  const tHeader = useTranslations('header')
  const locale = useLocale()

  const count = hydrated ? cartCount(items) : 0

  return (
    <div className="group relative">
      {/* Icon-only trigger (Shopee/ML style). Click still navigates to /cart,
          which keeps it usable on touch devices where hover doesn't fire. */}
      <Link
        href="/cart"
        aria-label={tHeader('cart')}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
      >
        <CartIcon className="h-[18px] w-[18px]" />
        {count > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold leading-none text-white shadow-glow ring-2 ring-bg">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Link>

      {/* Hover preview. The pt-2 wrapper bridges the gap to the trigger so the
          panel doesn't close while the pointer travels down to it. */}
      <div className="pointer-events-none absolute right-0 top-full z-50 w-72 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <div className="card overflow-hidden p-0 shadow-xl">
          {!hydrated || items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="text-3xl" aria-hidden>
                🛒
              </span>
              <p className="text-sm text-fg-muted">{t('previewEmpty')}</p>
            </div>
          ) : (
            <>
              <div className="scrollbar-thin max-h-64 divide-y divide-border overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 p-3"
                  >
                    <ProductImage
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 flex-none rounded-lg object-cover"
                      fallbackClassName="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-surface-2 text-base"
                      fallbackEmoji="🍽️"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {item.name}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {item.quantity} × {formatMoney(item.unitPrice, locale)}
                      </p>
                    </div>
                    <p className="flex-none text-sm font-semibold text-fg">
                      {formatMoney(
                        multiplyMoney(item.unitPrice, item.quantity),
                        locale,
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-border bg-surface-2/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-fg-muted">{t('total')}</span>
                  <span className="font-bold text-fg">
                    {formatMoney(cartTotal(items), locale)}
                  </span>
                </div>
                <Link
                  href="/cart"
                  className="btn-primary w-full justify-center"
                >
                  {t('viewCart')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CartIcon({ className = '' }: { className?: string }) {
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
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
