import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listProducts } from '@/lib/api/products'
import { ProductImage } from '@/components/ui/ProductImage'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null

  const t = await getTranslations('admin.products')
  const { data } = await listProducts({ limit: 50 })
  // Only ADMIN may create and edit products. MANAGER still reaches the detail
  // page, where the image (ADMIN+MANAGER) is the only thing they can change.
  const canEdit = ctx.role === 'ADMIN'
  const detailLabel = canEdit ? t('edit') : t('manageImage')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        {canEdit ? (
          <Link href="/admin/products/new" className="btn-primary">
            + {t('newProduct')}
          </Link>
        ) : null}
      </header>

      {data.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🍽️
          </span>
          <p className="text-fg-muted">{t('empty')}</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="grid gap-3 md:hidden">
            {data.map((p) => (
              <div key={p.id} className="card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-brand-soft">
                    <ProductImage
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      fallbackClassName="text-lg opacity-70"
                    />
                  </span>
                  <p className="min-w-0 flex-1 font-medium text-fg">{p.name}</p>
                  <span className="font-display text-lg font-bold text-gradient-brand">
                    {formatMoney(p.price, locale)}
                  </span>
                </div>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="btn-ghost min-h-[44px] w-full justify-center text-xs"
                >
                  {detailLabel}
                </Link>
              </div>
            ))}
          </div>

          {/* Tablet/desktop: data table */}
          <div className="card hidden overflow-hidden p-0 md:block">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">{t('tableImage')}</span>
                    </th>
                    <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                    <th className="px-4 py-3 font-medium">{t('tablePrice')}</th>
                    <th className="px-4 py-3 font-medium">
                      {t('tableStatus')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t('tableActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-3 pl-4">
                        {/* Sized on this inner span, not the cell: a width on a
                            <td> is only a suggestion under table-layout: auto. */}
                        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand-soft">
                          <ProductImage
                            src={p.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            fallbackClassName="text-base opacity-70"
                          />
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-fg">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        {formatMoney(p.price, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            p.isActive
                              ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
                              : 'bg-surface-2 text-fg-subtle'
                          }`}
                        >
                          {p.isActive ? t('statusActive') : t('statusInactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="btn-ghost !px-2 !py-1 text-xs"
                        >
                          {detailLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
