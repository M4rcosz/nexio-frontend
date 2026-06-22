'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cartCount, useCartStore } from '@/lib/cart/store'

export function CartBadge() {
  const items = useCartStore((s) => s.items)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const count = hydrated ? cartCount(items) : 0
  const t = useTranslations('header')
  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-all hover:border-border-strong hover:-translate-y-px"
      aria-label={t('cart')}
    >
      <CartIcon className="h-4 w-4" />
      <span className="hidden sm:inline">{t('cart')}</span>
      {count > 0 ? (
        <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-gradient px-1.5 text-[10px] font-bold text-white shadow-glow">
          {count}
        </span>
      ) : (
        <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-bold text-fg-subtle">
          0
        </span>
      )}
    </Link>
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
