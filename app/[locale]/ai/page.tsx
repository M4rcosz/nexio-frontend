import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getSession } from '@/lib/auth/session'
import { getMyAiMembership } from '@/lib/api/ai'
import { AiAssistantView } from '@/components/ai/AiAssistantView'
import { BackendBadge } from '@/components/StubBadge'

export const dynamic = 'force-dynamic'

export default async function AiAssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // The assistant is available to any authenticated user (access is gated by
  // the membership, not by role). Guard against direct navigation while logged
  // out — the middleware already redirects, this is defence in depth.
  const session = await getSession()
  if (!session) {
    redirect({ href: '/login', locale })
  }
  const t = await getTranslations('ai')
  const membership = await getMyAiMembership()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
        <BackendBadge />
      </div>
      <p className="-mt-2 text-sm text-fg-muted">{t('subtitle')}</p>
      <AiAssistantView initialMembership={membership} />
    </div>
  )
}
