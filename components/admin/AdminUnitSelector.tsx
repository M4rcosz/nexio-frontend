'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import type { PublicBusinessUnit } from '@/lib/api/types'

/**
 * Unit picker for ADMIN pages. Pushes the chosen unit into the `businessUnitId`
 * query param so the server component can re-fetch. MANAGER pages don't render
 * this — they are locked to their own unit.
 */
export function AdminUnitSelector({
  units,
  selected,
  labelKey,
}: {
  units: PublicBusinessUnit[]
  selected: string
  /** Translation key (within the page namespace) for the field label. */
  labelKey: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()

  function onChange(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('businessUnitId', value)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="w-full sm:max-w-xs">
      <label className="label" htmlFor="admin-unit">
        {t(labelKey)}
      </label>
      <select
        id="admin-unit"
        className="input"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  )
}
