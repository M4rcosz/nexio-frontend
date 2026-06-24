'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

/**
 * Public unit search. Drives the `unitSearch` query param (debounced); the home
 * page reads it and forwards it to `listBusinessUnits({ search })`, which hits
 * the public `GET /business-units` endpoint.
 */
export function UnitSearch({ initialSearch }: { initialSearch?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('home')
  const [search, setSearch] = useState(initialSearch ?? '')

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('unitSearch', search)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <input
      type="search"
      className="input sm:max-w-xs"
      placeholder={t('unitSearchPlaceholder')}
      aria-label={t('unitSearchPlaceholder')}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  )
}
