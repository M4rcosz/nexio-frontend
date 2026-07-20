import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listInternalUsers } from '@/lib/api/admin-users'
import { getBusinessUnit } from '@/lib/api/business-units'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null // layout already renders the 403 card

  const t = await getTranslations('admin.overview')
  // The staff counters below are a headline stat, not a listing — ask for the
  // server's maximum page. Unchanged from the pre-pagination behaviour, which
  // also topped out at 100.
  const [{ data: users }, unit] = await Promise.all([
    listInternalUsers(ctx, { limit: 100 }),
    ctx.scopedBusinessUnitId
      ? getBusinessUnit(ctx.scopedBusinessUnitId)
      : Promise.resolve(null),
  ])
  const activeCount = users.filter((u) => u.isActive).length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('yourRole')} value={ctx.role} />
        <StatCard
          label={t('managedUnits')}
          value={unit?.name ?? t('managedUnitsAll')}
        />
        <StatCard
          label="Staff users · active / total"
          value={`${activeCount} / ${users.length}`}
        />
      </section>

      <section className="card overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              users
            </p>
            <p className="mt-1 font-semibold text-fg">{t('manageUsers')}</p>
            <p className="text-xs text-fg-muted">{t('manageUsersHint')}</p>
          </div>
          <Link href="/admin/users" className="btn-primary">
            {t('manageUsers')}
          </Link>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-fg">{value}</p>
    </div>
  )
}
