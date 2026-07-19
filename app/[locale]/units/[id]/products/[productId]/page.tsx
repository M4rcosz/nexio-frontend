import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getBusinessUnit } from '@/lib/api/business-units'
import { getProduct } from '@/lib/api/products'
import { listMenu } from '@/lib/api/menu'
import { formatMoney } from '@/lib/money'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { ProductImage } from '@/components/ui/ProductImage'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string; productId: string; locale: string }>
}) {
  const { id, productId, locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('menu')

  const [unit, baseProduct, menuPage] = await Promise.all([
    getBusinessUnit(id),
    getProduct(productId),
    listMenu(id, { limit: 100 }),
  ])
  if (!unit || !baseProduct) notFound()

  // Charge the unit's effective menu price, not the catalog one, so the cart
  // matches what the order will bill. Falls back to the catalog price when
  // the unit has no menu configured.
  const menuPrice = menuPage.data.find((m) => m.productId === productId)?.price
  const product = menuPrice ? { ...baseProduct, price: menuPrice } : baseProduct

  return (
    <div className="space-y-6">
      <Link
        href={`/units/${id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-brand-500"
      >
        ← {t('switchUnit').replace('← ', '')}
      </Link>

      <article className="card grid gap-0 overflow-hidden p-0 md:grid-cols-2">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-brand-soft md:aspect-auto">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            fallbackClassName="text-8xl opacity-90"
          />
        </div>
        <div className="flex flex-col p-7 sm:p-9">
          <span className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('available', { unit: unit.name })}
          </span>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-fg-muted leading-relaxed">
            {product.description ?? t('noDescription')}
          </p>
          <div className="mt-8 flex items-baseline gap-3">
            <span className="font-display text-4xl font-bold text-gradient-brand">
              {formatMoney(product.price, locale)}
            </span>
          </div>
          <div className="mt-6">
            <AddToCartButton
              product={product}
              unitId={id}
              unitName={unit.name}
              large
            />
          </div>
        </div>
      </article>
    </div>
  )
}
