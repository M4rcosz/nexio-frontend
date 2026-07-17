'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Category } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

export function CategoryList({ categories }: { categories: Category[] }) {
  const t = useTranslations('admin.categories')
  const locale = useLocale()

  if (categories.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🗂️
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
        <p className="max-w-sm text-xs text-fg-subtle">{t('inactiveNote')}</p>
      </div>
    )
  }

  function StatusBadge({ category }: { category: Category }) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          category.isActive
            ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
            : 'bg-surface-2 text-fg-subtle'
        }`}
      >
        {category.isActive ? t('statusActive') : t('statusInactive')}
      </span>
    )
  }

  return (
    <>
      <p className="text-xs text-fg-subtle">{t('inactiveNote')}</p>

      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {categories.map((c) => (
          <div key={c.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-fg">{c.name}</p>
              <StatusBadge category={c} />
            </div>
            <p className="text-sm text-fg-muted">
              {c.description ?? t('noDescription')}
            </p>
            <Link
              href={`/admin/categories/${c.id}`}
              className="btn-ghost min-h-[44px] w-full justify-center text-xs"
            >
              {t('actionEdit')}
            </Link>
          </div>
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                <th className="px-4 py-3 font-medium">
                  {t('tableDescription')}
                </th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('tableUpdated')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-fg">{c.name}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {c.description ?? t('noDescription')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge category={c} />
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle">
                    {formatDateTime(c.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/categories/${c.id}`}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    >
                      {t('actionEdit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
