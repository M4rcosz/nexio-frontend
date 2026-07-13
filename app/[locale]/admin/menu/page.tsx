import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAdminContext } from '@/lib/auth/access'
import { listMenuManage } from '@/lib/api/menu'
import {
  listBusinessUnits,
  listBusinessUnitsInternal,
} from '@/lib/api/business-units'
import { listProducts } from '@/lib/api/products'
import { MenuManageTable } from '@/components/admin/MenuManageTable'
import { AddMenuItemForm } from '@/components/admin/AddMenuItemForm'
import { AdminUnitSelector } from '@/components/admin/AdminUnitSelector'

export const dynamic = 'force-dynamic'

export default async function AdminMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ businessUnitId?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null

  const sp = await searchParams
  const t = await getTranslations('admin.menu')

  // ADMIN picks any unit; MANAGER is locked to their own.
  const units =
    ctx.role === 'ADMIN' ? (await listBusinessUnitsInternal()).data : []
  // For ADMIN, only honour a selected unit that actually exists in their list
  // (validates the searchParam before it reaches a unit-scoped backend URL).
  const selectedUnitId =
    ctx.role === 'MANAGER'
      ? ctx.scopedBusinessUnitId
      : sp.businessUnitId && units.some((u) => u.id === sp.businessUnitId)
        ? sp.businessUnitId
        : (units[0]?.id ?? null)

  if (!selectedUnitId) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </header>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  const [menuPage, productsPage] = await Promise.all([
    listMenuManage(selectedUnitId, { limit: 100 }),
    listProducts({ limit: 100 }),
  ])
  const items = menuPage.data
  const productNames: Record<string, string> = {}
  for (const p of productsPage.data) productNames[p.id] = p.name

  // Resolve the MANAGER's own unit name for the locked label.
  let lockedUnitName: string | null = null
  if (ctx.role === 'MANAGER') {
    const { data } = await listBusinessUnits()
    lockedUnitName =
      data.find((u) => u.id === selectedUnitId)?.name ?? selectedUnitId
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      {ctx.role === 'ADMIN' ? (
        <AdminUnitSelector
          units={units}
          selected={selectedUnitId}
          labelKey="admin.menu.unitLabel"
        />
      ) : lockedUnitName ? (
        <p className="text-sm text-fg-muted">
          {t('unitLabel')}:{' '}
          <span className="font-medium text-fg">{lockedUnitName}</span>{' '}
          <span className="text-xs text-fg-subtle">({t('unitLocked')})</span>
        </p>
      ) : null}

      <p className="text-xs text-fg-subtle">
        {t('count', { count: items.length })}
      </p>

      <MenuManageTable
        businessUnitId={selectedUnitId}
        items={items}
        productNames={productNames}
      />

      <div className="card p-6">
        <AddMenuItemForm
          businessUnitId={selectedUnitId}
          products={productsPage.data.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  )
}
