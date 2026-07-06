import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getBusinessUnitInternal } from '@/lib/api/business-units'
import { BusinessUnitForm } from '@/components/admin/BusinessUnitForm'

export const dynamic = 'force-dynamic'

export default async function EditBusinessUnitPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN manages business units; hide the page from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const [unit, t] = await Promise.all([
    // The internal read returns the unit even when it is inactive, so a
    // deactivated one stays reachable (and reactivatable) through its link.
    getBusinessUnitInternal(id),
    getTranslations('admin.businessUnits.form'),
  ])
  if (!unit) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/business-units"
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
        <BusinessUnitForm mode="edit" unit={unit} />
      </div>
    </div>
  )
}
