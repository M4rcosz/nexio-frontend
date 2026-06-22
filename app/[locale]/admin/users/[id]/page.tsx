import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getInternalUser } from '@/lib/api/admin-users'
import { listBusinessUnits } from '@/lib/api/business-units'
import { UserForm } from '@/components/admin/UserForm'

export const dynamic = 'force-dynamic'

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  const [user, unitsPage, t] = await Promise.all([
    getInternalUser(ctx, id),
    listBusinessUnits(),
    getTranslations('admin.form'),
  ])
  if (!user) notFound()

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
          {t('editTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('editSubtitle')}</p>
      </header>
      <div className="card p-6">
        <UserForm
          mode="edit"
          user={user}
          units={unitsPage.data}
          scopedBusinessUnitId={
            ctx.role === 'MANAGER' ? ctx.scopedBusinessUnitId : null
          }
          manageableRoles={ctx.manageableRoles}
        />
      </div>
    </div>
  )
}
