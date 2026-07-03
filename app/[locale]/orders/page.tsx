import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { listMyOrders } from '@/lib/api/orders'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { StubBadge } from '@/components/StubBadge'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('orders')
  const tStatus = await getTranslations('orderStatus')
  const { data } = await listMyOrders()

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {t('title')}
          </h1>
          <StubBadge />
        </div>
        <span className="text-xs text-fg-subtle">
          {data.length} {data.length === 1 ? 'order' : 'orders'}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>📜</span>
          <p className="text-fg-muted">{t('empty')}</p>
          <Link href="/" className="btn-primary mt-2">
            {t('browseUnits')}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((order) => {
            const statusKey = order.orderStatus
            const isActive =
              statusKey !== 'DELIVERED' && statusKey !== 'CANCELLED'
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="card card-hover block p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                        {formatDateTime(order.createdAt, locale)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-fg-subtle">
                        {order.id}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="chip-warn">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" />
                        {tStatus(statusKey)}
                      </span>
                    ) : (
                      <span className="chip">{tStatus(statusKey)}</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                    <span className="text-xs text-fg-muted">
                      {t('itemsCount', {
                        count: order.orderItems.length,
                        total: '',
                      }).replace('· ', '')}
                    </span>
                    <span className="font-display text-xl font-bold text-gradient-brand">
                      {formatMoney(order.totalAmount, locale)}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
