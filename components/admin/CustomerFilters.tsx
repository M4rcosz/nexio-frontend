'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { FilterBar, FilterControl, FilterSearch } from './FilterBar'

/**
 * Username and e-mail are two separate backend filters, AND-combined — there
 * is no single free-text search across name/username/email — so they get two
 * inputs rather than one box that would silently only hit one field.
 */
export function CustomerFilters({
  initial,
}: {
  initial: { search?: string; email?: string }
}) {
  const t = useTranslations('admin.customers')

  const [search, setSearch] = useState(initial.search ?? '')
  const [email, setEmail] = useState(initial.email ?? '')

  return (
    <FilterBar values={{ search, email }}>
      <FilterSearch
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterControl width="sm:w-64">
        <input
          type="search"
          className="input w-full"
          placeholder={t('emailPlaceholder')}
          aria-label={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FilterControl>
    </FilterBar>
  )
}
