import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { listCategories } from '@/lib/api/categories'
import { CategoryList } from '@/components/admin/CategoryList'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN manages the catalog taxonomy; hide from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const t = await getTranslations('admin.categories')
  const { data } = await listCategories({ limit: 100 })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-fg">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <Link href="/admin/categories/new" className="btn-primary">
          + {t('newCategory')}
        </Link>
      </header>

      <p className="text-xs text-fg-subtle">
        {t('count', { count: data.length })}
      </p>

      <CategoryList categories={data} />
    </div>
  )
}
