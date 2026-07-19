import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listCustomers } from '@/lib/api/admin-users'
import { CustomerFilters } from '@/components/admin/CustomerFilters'
import { CustomerList } from '@/components/admin/CustomerList'

export const dynamic = 'force-dynamic'

type SearchParams = {
  search?: string
  email?: string
}

export default async function AdminCustomersPage({
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
  // Customers hold no unit link, so a MANAGER — pinned to their own units —
  // can never reach one. Rendering an always-empty screen for them would be
  // worse than not offering it; the sidebar entry is ADMIN-only to match.
  if (ctx.role !== 'ADMIN') notFound()

  const sp = await searchParams
  const t = await getTranslations('admin.customers')

  const firstPage = await listCustomers(ctx, {
    search: sp.search,
    email: sp.email,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <CustomerFilters initial={sp} />

      <CustomerList
        initialPage={firstPage}
        query={{ search: sp.search, email: sp.email }}
      />
    </div>
  )
}
