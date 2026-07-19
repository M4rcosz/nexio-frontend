import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { ProductResponseDto } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { ProductImage } from '@/components/ui/ProductImage'

export function ProductCard({
  product,
  unitId,
  unitName,
}: {
  product: ProductResponseDto
  unitId: string
  unitName: string
}) {
  const locale = useLocale()
  return (
    <article className="card card-hover group flex h-full flex-col overflow-hidden">
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-brand-soft">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallbackClassName="text-6xl opacity-80 transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Link
          href={`/units/${unitId}/products/${product.id}`}
          className="text-base font-semibold tracking-tight text-fg transition-colors hover:text-brand-500"
        >
          {product.name}
        </Link>
        {product.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">
            {product.description}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              price
            </span>
            <span className="font-display text-xl font-bold text-gradient-brand">
              {formatMoney(product.price, locale)}
            </span>
          </div>
          <AddToCartButton
            product={product}
            unitId={unitId}
            unitName={unitName}
          />
        </div>
      </div>
    </article>
  )
}
