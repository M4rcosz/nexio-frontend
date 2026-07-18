import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAdminContext } from '@/lib/auth/access'
import { listOrders } from '@/lib/api/orders'
import { listBusinessUnits } from '@/lib/api/business-units'
import { OrderBoard } from '@/components/admin/OrderBoard'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null

  const t = await getTranslations('admin.orders')
  const showUnitFilter = ctx.role === 'ADMIN'

  const [initial, unitsPage] = await Promise.all([
    listOrders({ limit: 20 }),
    showUnitFilter ? listBusinessUnits({ limit: 100 }) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <OrderBoard
        initial={initial}
        units={unitsPage?.data ?? []}
        showUnitFilter={showUnitFilter}
      />
    </div>
  )
}
