'use client'

import { useTranslations } from 'next-intl'
import type { Paginated, User } from '@/lib/api/types'
import { UserStatusBadge } from './UserStatusBadge'
import { LoadMore } from './LoadMore'
import { useCursorPages } from './useCursorPages'

/**
 * Customer base listing — read-only.
 *
 * Customers carry no business-unit link and their role is fixed at creation
 * (there is no role-edit endpoint), so there is nothing here to edit and no
 * unit column to show. Kept deliberately separate from `UserList`, which is
 * built around staff affordances the customer base does not have.
 */
export function CustomerList({
  initialPage,
  query,
}: {
  initialPage: Paginated<User>
  query: Record<string, string | undefined>
}) {
  const t = useTranslations('admin.customers')
  const { items, hasMore, loading, error, loadMore } = useCursorPages<User>({
    endpoint: '/api/admin/customers',
    query,
    initialPage,
  })

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🧾
          </span>
          {/* Neutral wording on purpose — never "try widening your filters".
              A MANAGER cannot widen past their unit claim, so that advice would
              be a dead end (docs §1.3). */}
          <p className="text-fg-muted">{t('empty')}</p>
        </div>
        {/* Customers are not post-filtered, so an empty page with a live
            cursor cannot happen today — but the invariant belongs in both
            lists, not just the one that can currently break it. */}
        {hasMore ? (
          <LoadMore
            hasMore={hasMore}
            loading={loading}
            error={error}
            loaded={0}
            onLoadMore={loadMore}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {items.map((c) => (
          <article key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{c.name}</p>
                <p className="truncate text-xs text-fg-subtle">{c.username}</p>
              </div>
              <UserStatusBadge active={c.isActive} />
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 border-t border-border pt-3 text-xs">
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-widest text-fg-subtle">
                  {t('tableEmail')}
                </dt>
                <dd className="mt-0.5 truncate text-fg">{c.email ?? '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-widest text-fg-subtle">
                  {t('tablePhone')}
                </dt>
                <dd className="mt-0.5 truncate text-fg">{c.phone ?? '—'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                <th className="px-4 py-3 font-medium">{t('tableEmail')}</th>
                <th className="px-4 py-3 font-medium">{t('tablePhone')}</th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{c.name}</div>
                    <div className="text-xs text-fg-subtle">{c.username}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-fg-muted">
                    {c.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-fg-muted">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusBadge active={c.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LoadMore
        hasMore={hasMore}
        loading={loading}
        error={error}
        loaded={items.length}
        onLoadMore={loadMore}
      />
    </div>
  )
}
