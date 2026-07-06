'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { Select } from '@/components/ui/Select'

export function BusinessUnitFilters({
  initial,
}: {
  initial: { search?: string; city?: string; isActive?: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('admin.businessUnits')

  const [search, setSearch] = useState(initial.search ?? '')
  const [city, setCity] = useState(initial.city ?? '')
  const [status, setStatus] = useState(initial.isActive ?? '')

  // Debounced query string push.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (city) params.set('city', city)
      if (status) params.set('isActive', status)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, status])

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className="input sm:max-w-sm"
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <input
        className="input sm:max-w-[200px]"
        placeholder={t('cityPlaceholder')}
        aria-label={t('cityPlaceholder')}
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <div className="sm:max-w-[180px] sm:flex-1">
        <Select
          value={status}
          onChange={setStatus}
          ariaLabel={t('filterStatusAll')}
          options={[
            { value: '', label: t('filterStatusAll') },
            { value: 'true', label: t('filterStatusActive') },
            { value: 'false', label: t('filterStatusInactive') },
          ]}
        />
      </div>
    </div>
  )
}
