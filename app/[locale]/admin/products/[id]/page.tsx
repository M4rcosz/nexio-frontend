import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getProduct } from '@/lib/api/products'
import { listCategories } from '@/lib/api/categories'
import { ProductForm } from '@/components/admin/ProductForm'
import { ProductImageManager } from '@/components/admin/ProductImageManager'
import { AdminFormCard } from '@/components/admin/AdminFormCard'

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
  // ADMIN edits the catalog fields; MANAGER opens the same page for the image
  // alone, since the two image routes are ADMIN+MANAGER while
  // `PATCH /products/:id` is ADMIN-only.
  const canEdit = ctx.role === 'ADMIN'

  const [product, categoriesPage, t] = await Promise.all([
    getProduct(id),
    canEdit ? listCategories({ limit: 100 }) : null,
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
          {canEdit ? t('editTitle') : product.name}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {canEdit ? t('editSubtitle') : t('imageOnlySubtitle')}
        </p>
      </header>
      <AdminFormCard>
        <ProductImageManager product={product} canClear={canEdit} />
      </AdminFormCard>
      {canEdit && categoriesPage ? (
        <AdminFormCard>
          <ProductForm
            mode="edit"
            product={product}
            categories={categoriesPage.data}
          />
        </AdminFormCard>
      ) : null}
    </div>
  )
}
