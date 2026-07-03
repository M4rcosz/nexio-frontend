import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getOrder } from '@/lib/api/orders'
import { OrderTracker } from '@/components/OrderTracker'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('order')
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              {t('title')}
            </h1>
          </div>
          <p className="mt-1 font-mono text-xs text-fg-subtle">
            {t('openedAt', {
              date: formatDateTime(order.createdAt, locale),
              id: order.id,
            })}
          </p>
        </div>
      </div>
      <OrderTracker initialOrder={order} />
    </div>
  )
}
