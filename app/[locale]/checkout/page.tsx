import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CheckoutView } from '@/components/CheckoutView'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('checkout')
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
      </div>
      <CheckoutView />
    </div>
  )
}
