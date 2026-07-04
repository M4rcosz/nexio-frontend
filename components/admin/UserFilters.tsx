'use client'

import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import type { PublicBusinessUnit, Role } from '@/lib/api/types'
import { Select } from '@/components/ui/Select'

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
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('admin.users')
  const tForm = useTranslations('admin.form')

  const [search, setSearch] = useState(initial.search ?? '')
  const [role, setRole] = useState(initial.role ?? '')
  const [businessUnitId, setBusinessUnitId] = useState(initial.businessUnitId ?? '')

  // Debounced query string push
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (role) params.set('role', role)
      if (businessUnitId) params.set('businessUnitId', businessUnitId)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, businessUnitId])

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className="input sm:max-w-sm"
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="sm:max-w-[180px] sm:flex-1">
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
      </div>
      {showUnitFilter ? (
        <div className="sm:max-w-[220px] sm:flex-1">
          <Select
            value={businessUnitId}
            onChange={setBusinessUnitId}
            ariaLabel={t('filterUnitAll')}
            options={[
              { value: '', label: t('filterUnitAll') },
              ...units.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
        </div>
      ) : null}
    </div>
  )
}
