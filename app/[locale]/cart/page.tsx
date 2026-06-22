import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CartView } from '@/components/CartView'

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('cart')
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
        {t('title')}
      </h1>
      <CartView />
    </div>
  )
}
