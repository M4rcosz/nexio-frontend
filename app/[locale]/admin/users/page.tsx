import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listInternalUsers } from '@/lib/api/admin-users'
import { listBusinessUnits } from '@/lib/api/business-units'
import { UserRow } from '@/components/admin/UserRow'
import { UserCard } from '@/components/admin/UserCard'
import { UserFilters } from '@/components/admin/UserFilters'

export const dynamic = 'force-dynamic'

type SearchParams = {
  search?: string
  role?: string
  businessUnitId?: string
}

export default async function AdminUsersPage({
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

  const sp = await searchParams
  const t = await getTranslations('admin.users')

  const [users, unitsPage] = await Promise.all([
    listInternalUsers(ctx, {
      search: sp.search,
      role: sp.role && ctx.manageableRoles.includes(sp.role as never)
        ? (sp.role as never)
        : undefined,
      businessUnitId: sp.businessUnitId,
    }),
    listBusinessUnits(),
  ])
  const unitsById = new Map(unitsPage.data.map((u) => [u.id, u]))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <Link href="/admin/users/new" className="btn-primary">
          + {t('newUser')}
        </Link>
      </header>

      <UserFilters
        units={unitsPage.data}
        initial={sp}
        showUnitFilter={ctx.role === 'ADMIN'}
        manageableRoles={ctx.manageableRoles}
      />

      <p className="text-xs text-fg-subtle">{t('count', { count: users.length })}</p>

      {users.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>👤</span>
          <p className="text-fg-muted">{t('empty')}</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="grid gap-3 md:hidden">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                unit={u.businessUnitId ? unitsById.get(u.businessUnitId) ?? null : null}
              />
            ))}
          </div>

          {/* Tablet/desktop: data table */}
          <div className="card hidden overflow-hidden p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                    <th className="px-4 py-3 font-medium">{t('tableRole')}</th>
                    <th className="px-4 py-3 font-medium">{t('tableUnit')}</th>
                    <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t('tableActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      unit={u.businessUnitId ? unitsById.get(u.businessUnitId) ?? null : null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
