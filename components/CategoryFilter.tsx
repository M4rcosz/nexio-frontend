import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Category } from '@/lib/api/types'

export function CategoryFilter({
  categories,
  selected,
  search,
  unitId,
}: {
  categories: Category[]
  selected?: string
  search?: string
  unitId: string
}) {
  const t = useTranslations('menu')

  function buildHref(catId?: string): string {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (catId) params.set('categoryId', catId)
    const qs = params.toString()
    return `/units/${unitId}${qs ? `?${qs}` : ''}`
  }

  const Pill = ({
    href,
    active,
    children,
  }: {
    href: string
    active: boolean
    children: React.ReactNode
  }) => (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'border-brand-500 bg-brand-gradient text-white shadow-glow'
          : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg'
      }`}
    >
      {children}
    </Link>
  )

  return (
    <div className="flex flex-wrap gap-2">
      <Pill href={buildHref(undefined)} active={!selected}>
        {t('all')}
      </Pill>
      {categories.map((c) => (
        <Pill key={c.id} href={buildHref(c.id)} active={selected === c.id}>
          {c.name}
        </Pill>
      ))}
    </div>
  )
}
