import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { listBusinessUnits } from '@/lib/api/business-units'
import { listMenu } from '@/lib/api/menu'
import { PosBoard } from '@/components/orders/PosBoard'

export const dynamic = 'force-dynamic'

export default async function PosPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSession()
  const t = await getTranslations('pos')

  // The layout already gates access; bail defensively if somehow reached
  // without a staff session.
  if (!session) return null

  const unitsPage = await listBusinessUnits({ limit: 100 })
  // ADMIN sees every unit; scoped staff only their own (JWT claim).
  const scoped = session.businessUnitIds ?? []
  const units =
    session.role === 'ADMIN'
      ? unitsPage.data
      : unitsPage.data.filter((u) => scoped.includes(u.id))

  if (units.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-fg-muted">
        {t('noUnits')}
      </div>
    )
  }

  const initialUnitId = units[0].id
  const menu = await listMenu(initialUnitId, { limit: 100 })

  return (
    <PosBoard
      units={units}
      initialUnitId={initialUnitId}
      initialProducts={menu.data}
    />
  )
}
