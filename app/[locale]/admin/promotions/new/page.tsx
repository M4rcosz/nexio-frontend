import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listBusinessUnitsInternal } from '@/lib/api/business-units'
import { PromotionForm } from '@/components/admin/PromotionForm'

export const dynamic = 'force-dynamic'

export default async function NewPromotionPage({
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
  const t = await getTranslations('admin.promotions.form')

  let units =
    ctx.role === 'ADMIN' ? (await listBusinessUnitsInternal()).data : []
  // When the admin came from a specific unit, surface it first.
  if (sp.businessUnitId) {
    const idx = units.findIndex((u) => u.id === sp.businessUnitId)
    if (idx > 0) units = [units[idx], ...units.filter((_, i) => i !== idx)]
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/promotions"
        className="text-sm font-medium text-fg-muted hover:text-brand-500"
      >
        {t('back')}
      </Link>
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
          {t('createTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('createSubtitle')}</p>
      </header>
      <div className="card p-6">
        <PromotionForm
          mode="create"
          units={units}
          scopedBusinessUnitId={
            ctx.role === 'MANAGER' ? ctx.scopedBusinessUnitId : null
          }
        />
      </div>
    </div>
  )
}
