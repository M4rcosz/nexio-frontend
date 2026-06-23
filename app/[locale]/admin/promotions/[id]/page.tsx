import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getPromotion } from '@/lib/api/promotions'
import { listBusinessUnitsInternal } from '@/lib/api/business-units'
import { PromotionForm } from '@/components/admin/PromotionForm'

export const dynamic = 'force-dynamic'

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null

  const [promotion, t] = await Promise.all([
    getPromotion(id),
    getTranslations('admin.promotions.form'),
  ])
  if (!promotion) notFound()

  // MANAGER may only edit promotions for their own unit.
  if (
    ctx.role === 'MANAGER' &&
    ctx.scopedBusinessUnitId !== promotion.businessUnitId
  ) {
    notFound()
  }

  const units =
    ctx.role === 'ADMIN' ? (await listBusinessUnitsInternal()).data : []

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
          {t('editTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('editSubtitle')}</p>
      </header>
      <div className="card p-6">
        <PromotionForm
          mode="edit"
          promotion={promotion}
          units={units.length > 0 ? units : [
            // Edit view locks the unit; ensure the current one renders even when
            // the internal list is empty (MANAGER) by synthesizing a minimal row.
            {
              id: promotion.businessUnitId,
              name: promotion.businessUnitId,
              cnpj: '',
              address: '',
              city: '',
              phone: '',
              isActive: true,
            },
          ]}
          scopedBusinessUnitId={
            ctx.role === 'MANAGER'
              ? ctx.scopedBusinessUnitId
              : promotion.businessUnitId
          }
        />
      </div>
    </div>
  )
}
