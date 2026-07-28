import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getSession } from '@/lib/auth/session'
import { getMyAiMembership, listAiConversations } from '@/lib/api/ai'
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
  // The thread list is self-scoped and cheap; fetching it alongside the wallet
  // means the sidebar renders populated instead of flashing in after hydration.
  const [membership, conversations] = await Promise.all([
    getMyAiMembership(),
    listAiConversations(),
  ])

  return (
    // The title block is handed to the view rather than rendered around it:
    // the token balance shares this row and only the client component knows it.
    <AiAssistantView
      initialMembership={membership}
      initialConversations={conversations}
      heading={
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              {t('title')}
            </h1>
            <BackendBadge />
          </div>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
      }
    />
  )
}
