import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { ApiError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { listInternalUsers } from '@/lib/api/admin-users'
import { listBusinessUnits } from '@/lib/api/business-units'
import { UserList } from '@/components/admin/UserList'
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

  const role =
    sp.role && ctx.manageableRoles.includes(sp.role as never)
      ? (sp.role as never)
      : undefined

  // A MANAGER passing a unit outside their claim is answered 404 by the
  // backend on purpose, so units cannot be enumerated. Uncaught, that throws
  // inside the render and produces a crash boundary; render the ordinary
  // not-found page instead. The wording stays generic either way, so a
  // foreign unit and a nonexistent one remain indistinguishable (docs §1.3).
  const [firstPage, unitsPage] = await Promise.all([
    listInternalUsers(ctx, {
      search: sp.search,
      role,
      businessUnitId: sp.businessUnitId,
    }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound()
      throw err
    }),
    listBusinessUnits(),
  ])

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

      <UserList
        initialPage={firstPage}
        query={{
          search: sp.search,
          role,
          businessUnitId: sp.businessUnitId,
        }}
        units={unitsPage.data}
      />
    </div>
  )
}
