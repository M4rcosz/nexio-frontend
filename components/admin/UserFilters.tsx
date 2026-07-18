'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { PublicBusinessUnit, Role } from '@/lib/api/types'
import { Select } from '@/components/ui/Select'
import {
  FilterBar,
  FilterControl,
  FilterSearch,
} from '@/components/admin/FilterBar'

const ROLE_LABEL_KEY: Record<Role, string> = {
  ATTENDANT: 'roleAttendant',
  KITCHEN: 'roleKitchen',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
  CUSTOMER: 'roleAttendant',
}

export function UserFilters({
  units,
  initial,
  showUnitFilter,
  manageableRoles,
}: {
  units: PublicBusinessUnit[]
  initial: { search?: string; role?: string; businessUnitId?: string }
  showUnitFilter: boolean
  manageableRoles: Role[]
}) {
  const t = useTranslations('admin.users')
  const tForm = useTranslations('admin.form')
  const tCommon = useTranslations('common')

  const [search, setSearch] = useState(initial.search ?? '')
  const [role, setRole] = useState(initial.role ?? '')
  const [businessUnitId, setBusinessUnitId] = useState(
    initial.businessUnitId ?? '',
  )

  return (
    <FilterBar values={{ search, role, businessUnitId }}>
      <FilterSearch
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterControl>
        <Select
          value={role}
          onChange={setRole}
          ariaLabel={t('filterRoleAll')}
          options={[
            { value: '', label: t('filterRoleAll') },
            ...manageableRoles.map((r) => ({
              value: r,
              label: tForm(ROLE_LABEL_KEY[r]),
            })),
          ]}
        />
      </FilterControl>
      {showUnitFilter ? (
        <FilterControl width="sm:w-56">
          <Select
            value={businessUnitId}
            onChange={setBusinessUnitId}
            ariaLabel={t('filterUnitAll')}
            options={[
              { value: '', label: t('filterUnitAll') },
              ...units.map((u) => ({ value: u.id, label: u.name })),
            ]}
            searchable
            searchPlaceholder={tCommon('search')}
            noResultsLabel={tCommon('noResults')}
          />
        </FilterControl>
      ) : null}
    </FilterBar>
  )
}
