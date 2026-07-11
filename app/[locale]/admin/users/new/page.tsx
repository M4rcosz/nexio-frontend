import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listBusinessUnits } from '@/lib/api/business-units'
import { UserForm } from '@/components/admin/UserForm'

export default async function NewUserPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  const t = await getTranslations('admin.form')
  const { data: units } = await listBusinessUnits()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
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
        <UserForm
          mode="create"
          units={units}
          scopedBusinessUnitIds={
            ctx.role === 'MANAGER' ? ctx.scopedBusinessUnitIds : null
          }
          manageableRoles={ctx.manageableRoles}
        />
      </div>
    </div>
  )
}
