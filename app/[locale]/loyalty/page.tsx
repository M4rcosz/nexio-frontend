import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getMyLoyalty } from '@/lib/api/loyalty'
import { LoyaltyView } from '@/components/LoyaltyView'

export const dynamic = 'force-dynamic'

export default async function LoyaltyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('loyalty')
  const account = await getMyLoyalty()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
      </div>
      <LoyaltyView initial={account} />
    </div>
  )
}
