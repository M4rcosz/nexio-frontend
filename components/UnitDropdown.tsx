'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Select } from '@/components/ui/Select'

type UnitOption = { id: string; name: string; city: string }

/**
 * Unit picker for the home hero. Selecting a unit drives the `?unit=<id>` query
 * param; the server component reads it and renders that unit's products below.
 * The default (no param) is resolved server-side to the first unit found.
 */
export function UnitDropdown({
  units,
  selectedId,
}: {
  units: UnitOption[]
  selectedId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('home')
  const [pending, start] = useTransition()

  function onChange(id: string) {
    start(() => {
      const params = new URLSearchParams()
      params.set('unit', id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="inline-flex flex-col gap-1.5">
      <span className="pl-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
        {t('yourUnit')}
      </span>
      <Select
        value={selectedId ?? ''}
        onChange={onChange}
        disabled={pending}
        fullWidth={false}
        ariaLabel={t('chooseUnit')}
        options={units.map((u) => ({
          value: u.id,
          label: `${u.name} · ${u.city}`,
        }))}
        leading={<PinIcon className="h-[18px] w-[18px] flex-none text-brand-600" />}
        className="rounded-2xl bg-white py-3 pl-4 pr-4 text-sm font-bold text-brand-700 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand-500/25 sm:min-w-[280px] sm:text-base"
      />
    </div>
  )
}

function PinIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
