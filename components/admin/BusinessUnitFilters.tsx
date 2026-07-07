'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import {
  FilterBar,
  FilterControl,
  FilterSearch,
} from '@/components/admin/FilterBar'

export function BusinessUnitFilters({
  initial,
}: {
  initial: { search?: string; city?: string; isActive?: string }
}) {
  const t = useTranslations('admin.businessUnits')

  const [search, setSearch] = useState(initial.search ?? '')
  const [city, setCity] = useState(initial.city ?? '')
  const [status, setStatus] = useState(initial.isActive ?? '')

  return (
    <FilterBar values={{ search, city, isActive: status }}>
      <FilterSearch
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterControl width="sm:w-48">
        <input
          className="input"
          placeholder={t('cityPlaceholder')}
          aria-label={t('cityPlaceholder')}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </FilterControl>
      <FilterControl>
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
      </FilterControl>
    </FilterBar>
  )
}
