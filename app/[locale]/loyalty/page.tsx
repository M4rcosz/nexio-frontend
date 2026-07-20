import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getSession } from '@/lib/auth/session'
import { getMyLoyalty } from '@/lib/api/loyalty'
import { LoyaltyView } from '@/components/loyalty/LoyaltyView'

export const dynamic = 'force-dynamic'

export default async function LoyaltyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // Loyalty points are a customer-only program. Staff roles have no account,
  // so guard the page against direct navigation (the header hides the link).
  const session = await getSession()
  if (session?.role !== 'CUSTOMER') {
    redirect({ href: '/', locale })
  }
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
