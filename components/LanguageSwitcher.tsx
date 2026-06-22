'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('languageSwitcher')
  const [pending, start] = useTransition()

  function setLocale(next: string) {
    if (next === locale) return
    start(() => {
      router.replace(pathname, {
        locale: next as (typeof routing.locales)[number],
      })
    })
  }

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="lang-switcher">
        {t('label')}
      </label>
      <select
        id="lang-switcher"
        aria-label={t('label')}
        disabled={pending}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-xl border border-border bg-surface pl-3 pr-7 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {l === 'en' ? 'EN' : 'PT'}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-subtle"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
