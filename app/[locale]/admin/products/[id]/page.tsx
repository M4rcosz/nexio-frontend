import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getProduct } from '@/lib/api/products'
import { ProductForm } from '@/components/admin/ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN edits products; hide the page from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const [product, t] = await Promise.all([
    getProduct(id),
    getTranslations('admin.products.form'),
  ])
  if (!product) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="text-sm font-medium text-fg-muted hover:text-brand-500"
      >
        {t('back')}
      </Link>
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
          {t('editTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('editSubtitle')}</p>
      </header>
      <div className="card p-6">
        <ProductForm product={product} />
      </div>
    </div>
  )
}
