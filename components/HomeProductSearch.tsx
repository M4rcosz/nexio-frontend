'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { ProductResponseDto } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'
import { useCartStore } from '@/lib/cart/store'

export function HomeProductSearch({
  defaultUnitId,
}: {
  /** Where to send the user when they pick a product result. */
  defaultUnitId: string | null
}) {
  const t = useTranslations('home.search')
  const locale = useLocale()
  const cartUnitId = useCartStore((s) => s.businessUnitId)
  const targetUnitId = cartUnitId ?? defaultUnitId

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResponseDto[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounced search
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(term)}`,
          { signal: ctrl.signal, cache: 'no-store' },
        )
        const body = (await res.json()) as { data?: ProductResponseDto[] }
        setResults(body.data ?? [])
        setOpen(true)
      } catch {
        /* aborted or failed — ignore */
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  function hrefFor(p: ProductResponseDto): string {
    return targetUnitId ? `/units/${targetUnitId}/products/${p.id}` : `/units`
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t('placeholder')}
          className="w-full rounded-2xl border border-white/25 bg-black/25 py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-white/60 shadow-glow-sm backdrop-blur-md transition focus:border-white/60 focus:outline-none focus:ring-4 focus:ring-white/15 sm:text-base"
          aria-label={t('placeholder')}
        />
        {loading ? (
          <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-soft-lg">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">
              {loading ? t('searching') : t('empty')}
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <Link
                    href={hrefFor(p)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-soft text-xl">
                      🍲
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">
                        {p.name}
                      </span>
                      {p.description ? (
                        <span className="block truncate text-xs text-fg-subtle">
                          {p.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex-none font-display text-sm font-bold text-brand-600 dark:text-brand-300">
                      {formatMoney(p.price, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
