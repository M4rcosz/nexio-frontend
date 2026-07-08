import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { getCategory } from '@/lib/api/categories'
import { CategoryForm } from '@/components/admin/CategoryForm'

export const dynamic = 'force-dynamic'

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // Only ADMIN manages categories; hide the page from MANAGER.
  if (ctx.role !== 'ADMIN') notFound()

  const [category, t] = await Promise.all([
    // GET by id returns the category even when it is inactive, so a deactivated
    // one stays reachable (and reactivatable) through its direct link.
    getCategory(id),
    getTranslations('admin.categories.form'),
  ])
  if (!category) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/categories"
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
        <CategoryForm mode="edit" category={category} />
      </div>
    </div>
  )
}
