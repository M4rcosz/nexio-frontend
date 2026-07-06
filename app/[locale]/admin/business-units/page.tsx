import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listBusinessUnitsInternal } from '@/lib/api/business-units'
import { BusinessUnitList } from '@/components/admin/BusinessUnitList'
import { BusinessUnitFilters } from '@/components/admin/BusinessUnitFilters'

export const dynamic = 'force-dynamic'

type SearchParams = {
  search?: string
  city?: string
  isActive?: string
}

export default async function AdminBusinessUnitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN manages business units; hide from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const sp = await searchParams
  const isActive =
    sp.isActive === 'true' ? true : sp.isActive === 'false' ? false : undefined

  const t = await getTranslations('admin.businessUnits')
  const page = await listBusinessUnitsInternal({
    search: sp.search,
    city: sp.city,
    isActive,
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <Link href="/admin/business-units/new" className="btn-primary">
          + {t('newBusinessUnit')}
        </Link>
      </header>

      <BusinessUnitFilters initial={sp} />

      <p className="text-xs text-fg-subtle">
        {t('count', { count: page.data.length })}
      </p>

      <BusinessUnitList
        key={`${sp.search ?? ''}|${sp.city ?? ''}|${sp.isActive ?? ''}`}
        initial={page}
        filters={{ search: sp.search, city: sp.city, isActive }}
      />
    </div>
  )
}
