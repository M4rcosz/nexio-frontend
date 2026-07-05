'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { Select } from '@/components/ui/Select'

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
    <Select
      value={locale}
      onChange={setLocale}
      disabled={pending}
      fullWidth={false}
      align="end"
      ariaLabel={t('label')}
      options={routing.locales.map((l) => ({
        value: l,
        label: l === 'en' ? 'EN' : 'PT',
      }))}
      className="h-9 rounded-xl border border-border bg-surface px-3 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus:outline-none focus:ring-4 focus:ring-brand-500/20"
    />
  )
}
