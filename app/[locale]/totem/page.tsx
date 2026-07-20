import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { listBusinessUnits } from '@/lib/api/business-units'
import { listMenu } from '@/lib/api/menu'
import { TotemFlow } from '@/components/orders/TotemFlow'

export const dynamic = 'force-dynamic'

/**
 * KIOSK AUTH DECISION (interim): the channel policy says a TOTEM order needs no
 * staff actor and no customer, but the Next route handler that proxies
 * `POST /api/orders` still requires *some* authenticated session to carry a
 * Bearer to the backend (see hasActiveOrRefreshableSession + serverFetch). The
 * current auth model has no dedicated device/service account, so — without
 * changing the backend — this is deployed as an "attended kiosk": a staff
 * device authenticates the session, and the TOTEM channel means the backend
 * still attaches no attendant/customer to the order. Gating therefore mirrors
 * the POS surface. See the task report for the flagged gap.
 */
const KIOSK_ROLES = new Set(['ADMIN', 'MANAGER', 'ATTENDANT'])

export default async function TotemPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSession()
  const t = await getTranslations('totem')

  if (!session || !KIOSK_ROLES.has(session.role)) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card p-8 text-center">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg">
            {t('unavailableTitle')}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">{t('unavailableBody')}</p>
        </div>
      </div>
    )
  }

  const unitsPage = await listBusinessUnits({ limit: 100 })
  const scoped = session.businessUnitIds ?? []
  const unit =
    session.role === 'ADMIN'
      ? unitsPage.data[0]
      : unitsPage.data.find((u) => scoped.includes(u.id))

  if (!unit) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card p-8 text-center text-sm text-fg-muted">
          {t('noUnit')}
        </div>
      </div>
    )
  }

  const menu = await listMenu(unit.id, { limit: 100 })

  return <TotemFlow unit={unit} products={menu.data} />
}
