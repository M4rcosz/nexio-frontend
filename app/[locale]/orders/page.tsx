import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { listMyOrders } from '@/lib/api/orders'
import { ApiError } from '@/lib/api/errors'
import { MyOrdersList } from '@/components/orders/MyOrdersList'
import type { Order, Paginated } from '@/lib/api/types'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('orders')

  let initial: Paginated<Order>
  try {
    initial = await listMyOrders({ limit: 20 })
  } catch (err) {
    // `GET /orders/me` is customer-only — staff callers get 403.
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      return (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {t('title')}
          </h1>
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <span className="text-5xl" aria-hidden>
              🔒
            </span>
            <p className="text-fg-muted">{t('forbidden')}</p>
            <Link href="/login" className="btn-primary mt-2">
              {t('signInLink')}
            </Link>
          </div>
        </div>
      )
    }
    throw err
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
      </div>

      {initial.data.length === 0 && !initial.meta.hasMore ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            📜
          </span>
          <p className="text-fg-muted">{t('empty')}</p>
          <Link href="/" className="btn-primary mt-2">
            {t('browseUnits')}
          </Link>
        </div>
      ) : (
        <MyOrdersList initial={initial} />
      )}
    </div>
  )
}
