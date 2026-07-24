import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getBusinessUnit } from '@/lib/api/business-units'
import { listProductsByBusinessUnit } from '@/lib/api/products'
import { listMenu } from '@/lib/api/menu'
import { listCategories } from '@/lib/api/categories'
import { listActivePromotions } from '@/lib/api/promotions'
import { ProductCard } from '@/components/catalog/ProductCard'
import { PromotionBanner } from '@/components/catalog/PromotionBanner'
import { BackendBadge } from '@/components/StubBadge'
import { CategoryFilter } from '@/components/catalog/CategoryFilter'

type SearchParams = { search?: string; categoryId?: string }

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const t = await getTranslations('menu')

  const [unit, productsPage, menuPage, categoriesPage, promotions] =
    await Promise.all([
      getBusinessUnit(id),
      listProductsByBusinessUnit(id, {
        search: sp.search,
        categoryId: sp.categoryId,
      }),
      listMenu(id, { limit: 100 }),
      listCategories(),
      listActivePromotions(id),
    ])

  if (!unit) notFound()

  // The menu carries the unit's effective price (and hides unavailable
  // items); the product listing keeps search/category filters. Join both so
  // the cart is built with the price the order will actually charge. When the
  // unit has no menu configured, fall back to catalog prices.
  const menuPriceByProduct = new Map(
    menuPage.data.map((m) => [m.productId, m.price]),
  )
  const products =
    menuPriceByProduct.size > 0
      ? productsPage.data
          .filter((p) => menuPriceByProduct.has(p.id))
          .map((p) => ({ ...p, price: menuPriceByProduct.get(p.id)! }))
      : productsPage.data
  const categories = categoriesPage.data

  return (
    <div className="space-y-8">
      {/* Unit hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-bg-elevated">
        <div className="absolute inset-0 bg-brand-soft" aria-hidden />
        <div className="relative flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-fg-muted hover:text-brand-500"
            >
              ← {t('switchUnit').replace('← ', '')}
            </Link>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-4xl">
              {unit.name}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              {unit.address} · {unit.city}
            </p>
          </div>
        </div>
      </section>

      {/* Live promotions -------------------------------------------------- */}
      <PromotionBanner promotions={promotions} />

      {/* Menu ------------------------------------------------------------ */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-fg">
              {t('title')}
            </h2>
            <BackendBadge />
          </div>
        </div>

        <form
          method="GET"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              name="search"
              placeholder={t('searchPlaceholder')}
              defaultValue={sp.search ?? ''}
              className="input pl-10"
            />
          </div>
          {sp.categoryId ? (
            <input type="hidden" name="categoryId" value={sp.categoryId} />
          ) : null}
          <button type="submit" className="btn-secondary">
            {t('search')}
          </button>
        </form>

        <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
          <CategoryFilter
            categories={categories}
            selected={sp.categoryId}
            search={sp.search}
            unitId={id}
          />
        </div>

        {products.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-12 text-center">
            <span className="text-4xl" aria-hidden>
              🌶️
            </span>
            <p className="text-sm text-fg-muted">{t('empty')}</p>
          </div>
        ) : (
          // Intrinsic columns — see the same grid on the home page: the card
          // size is fixed and columns are added as the shell widens. The `sm:`
          // prefix keeps sub-640px at a single column.
          <ul className="grid gap-5 sm:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} unitId={id} unitName={unit.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
