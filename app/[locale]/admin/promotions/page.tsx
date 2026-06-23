import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listPromotionsByBusinessUnit } from '@/lib/api/promotions'
import {
  listBusinessUnits,
  listBusinessUnitsInternal,
} from '@/lib/api/business-units'
import { PromotionList } from '@/components/admin/PromotionList'
import { AdminUnitSelector } from '@/components/admin/AdminUnitSelector'

export const dynamic = 'force-dynamic'

export default async function AdminPromotionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ businessUnitId?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null

  const sp = await searchParams
  const t = await getTranslations('admin.promotions')

  const units =
    ctx.role === 'ADMIN' ? (await listBusinessUnitsInternal()).data : []
  const selectedUnitId =
    ctx.role === 'MANAGER'
      ? ctx.scopedBusinessUnitId
      : sp.businessUnitId ?? units[0]?.id ?? null

  if (!selectedUnitId) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </header>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  const page = await listPromotionsByBusinessUnit(selectedUnitId)

  let lockedUnitName: string | null = null
  if (ctx.role === 'MANAGER') {
    const { data } = await listBusinessUnits()
    lockedUnitName =
      data.find((u) => u.id === selectedUnitId)?.name ?? selectedUnitId
  }

  const newHref =
    ctx.role === 'ADMIN'
      ? `/admin/promotions/new?businessUnitId=${selectedUnitId}`
      : '/admin/promotions/new'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <Link href={newHref} className="btn-primary">
          + {t('newPromotion')}
        </Link>
      </header>

      {ctx.role === 'ADMIN' ? (
        <AdminUnitSelector
          units={units}
          selected={selectedUnitId}
          labelKey="admin.promotions.unitLabel"
        />
      ) : lockedUnitName ? (
        <p className="text-sm text-fg-muted">
          {t('unitLabel')}: <span className="font-medium text-fg">{lockedUnitName}</span>{' '}
          <span className="text-xs text-fg-subtle">({t('unitLocked')})</span>
        </p>
      ) : null}

      <p className="text-xs text-fg-subtle">
        {t('count', { count: page.data.length })}
      </p>

      <PromotionList promotions={page.data} />
    </div>
  )
}
