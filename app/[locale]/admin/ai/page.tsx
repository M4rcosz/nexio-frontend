import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAdminContext } from '@/lib/auth/access'
import { listInternalUsers } from '@/lib/api/admin-users'
import { listAiMembershipUsage } from '@/lib/api/ai'
import { AiMembershipManager } from '@/components/admin/AiMembershipManager'
import { AiUsageReport } from '@/components/admin/AiUsageReport'
import { BackendBadge } from '@/components/StubBadge'

export const dynamic = 'force-dynamic'

export default async function AdminAiPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null // layout already renders the 403 card

  const t = await getTranslations('admin.ai')

  // Enroll/adjust are ADMIN-only (MANAGER gets a backend 403). Show a scoped
  // notice rather than a broken form for a manager who reached the URL directly.
  if (ctx.role !== 'ADMIN') {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">{t('adminOnly')}</p>
      </div>
    )
  }

  // Staff users are the targets we can enumerate for the picker (there is no
  // customer-listing endpoint). The dropdown needs the whole roster, not a page
  // of it — ask for the server's maximum. Unchanged from the pre-pagination
  // behaviour, which also topped out at 100.
  // The usage report defaults to the last 30 days server-side; its own
  // `periodFrom`/`periodTo` is what the client renders, so nothing is assumed
  // about that window here.
  const [{ data: users }, usage] = await Promise.all([
    listInternalUsers(ctx, { limit: 100 }),
    listAiMembershipUsage(),
  ])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
              {t('title')}
            </h1>
            <BackendBadge />
          </div>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
      </header>

      <AiMembershipManager
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
        }))}
      />

      <AiUsageReport initialReport={usage} />
    </div>
  )
}
