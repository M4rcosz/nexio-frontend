import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getOrder } from '@/lib/api/orders'
import { formatMoney } from '@/lib/money'
import { PaymentView } from '@/components/checkout/PaymentView'

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string; locale: string }>
}) {
  const { orderId, locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('payment')
  const tStatus = await getTranslations('orderStatus')

  const order = await getOrder(orderId)
  if (!order) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
      </div>

      <div className="card grid gap-3 p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
            order
          </p>
          <p className="mt-1 truncate font-mono text-fg">{order.id}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
            total
          </p>
          <p className="mt-1 font-display text-lg font-bold text-gradient-brand">
            {formatMoney(order.totalAmount, locale)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
            status
          </p>
          <p className="mt-1 font-medium text-fg">
            {tStatus(order.orderStatus)}
          </p>
        </div>
      </div>

      <PaymentView orderId={order.id} amount={order.totalAmount} />
    </div>
  )
}
