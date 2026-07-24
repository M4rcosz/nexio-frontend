import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listCategories } from '@/lib/api/categories'
import { ProductForm } from '@/components/admin/ProductForm'
import { AdminFormCard } from '@/components/admin/AdminFormCard'

export const dynamic = 'force-dynamic'

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN creates products; hide the page from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const [categoriesPage, t] = await Promise.all([
    listCategories({ limit: 100 }),
    getTranslations('admin.products.form'),
  ])

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
          {t('createTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('createSubtitle')}</p>
      </header>
      <AdminFormCard>
        <ProductForm mode="create" categories={categoriesPage.data} />
      </AdminFormCard>
    </div>
  )
}
