import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { listBusinessUnits } from '@/lib/api/business-units'
import { listProductsByBusinessUnit } from '@/lib/api/products'
import { listMenu } from '@/lib/api/menu'
import { HomeProductSearch } from '@/components/HomeProductSearch'
import { UnitDropdown } from '@/components/UnitDropdown'
import { ProductCard } from '@/components/ProductCard'
import { PrefetchAuthRoutes } from '@/components/PrefetchAuthRoutes'
import { getTenant } from '@/lib/tenant/resolve'

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ unit?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { unit } = await searchParams
  const t = await getTranslations('home')
  const tMenu = await getTranslations('menu')
  const tenant = await getTenant()

  const { data: units } = await listBusinessUnits({ limit: 50 })

  // Default selection = first unit found; the `?unit=` param overrides it only
  // when it points at a unit that actually exists (otherwise fall back).
  const selectedUnit =
    (unit ? units.find((u) => u.id === unit) : undefined) ?? units[0] ?? null

  // Products of the selected unit, priced with its effective menu price
  // (falling back to catalog price when the unit has no menu configured).
  let products: Awaited<ReturnType<typeof listProductsByBusinessUnit>>['data'] =
    []
  if (selectedUnit) {
    const [productsPage, menuPage] = await Promise.all([
      listProductsByBusinessUnit(selectedUnit.id, { limit: 100 }),
      listMenu(selectedUnit.id, { limit: 100 }),
    ])
    const priceByProduct = new Map(
      menuPage.data.map((m) => [m.productId, m.price]),
    )
    products =
      priceByProduct.size > 0
        ? productsPage.data
            .filter((p) => priceByProduct.has(p.id))
            .map((p) => ({ ...p, price: priceByProduct.get(p.id)! }))
        : productsPage.data
  }

  return (
    <div className="space-y-12">
      {/* Background-prefetch the likely next destinations (login/register). */}
      <PrefetchAuthRoutes />
      {/* Hero ----------------------------------------------------------- */}
      {/* No `overflow-hidden` on the section itself: the unit dropdown's popover
          is absolutely positioned and must be free to overflow the hero. The
          decorative gradient/grain is clipped by its own rounded wrapper. */}
      <section className="relative rounded-3xl border border-border bg-bg-elevated">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
          aria-hidden
        >
          <div className="grain absolute inset-0 bg-brand-gradient" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" />
        </div>
        <div className="relative px-5 py-10 sm:px-12 sm:py-20 lg:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {tenant.name}
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-white sm:mt-5 sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:mt-5 sm:text-lg">
            {t('heroSubtitle')}
          </p>

          {/* Global product search */}
          <div className="mt-6 sm:mt-8">
            <HomeProductSearch defaultUnitId={selectedUnit?.id ?? null} />
          </div>

          {/* Unit picker (default = first unit) */}
          {units.length > 0 ? (
            <div className="mt-4">
              <UnitDropdown
                units={units}
                selectedId={selectedUnit?.id ?? null}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Selected unit's products --------------------------------------- */}
      {selectedUnit ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                {t('menuHeading', { unit: selectedUnit.name })}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-fg-muted">
                {t('menuSubtitle')}
              </p>
            </div>
            <Link
              href={`/units/${selectedUnit.id}`}
              className="btn-secondary flex-none"
            >
              {t('viewFullUnit')}
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 p-12 text-center">
              <span className="text-4xl" aria-hidden>
                🌶️
              </span>
              <p className="text-sm text-fg-muted">{tMenu('empty')}</p>
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    product={p}
                    unitId={selectedUnit.id}
                    unitName={selectedUnit.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <div className="card flex flex-col items-center gap-2 p-12 text-center">
            <span className="text-4xl" aria-hidden>
              🏬
            </span>
            <p className="text-sm text-fg-muted">{t('noUnitsHint')}</p>
          </div>
        </section>
      )}
    </div>
  )
}
