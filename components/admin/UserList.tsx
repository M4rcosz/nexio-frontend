'use client'

import { useTranslations } from 'next-intl'
import type { Paginated, PublicBusinessUnit, User } from '@/lib/api/types'
import { UserRow } from './UserRow'
import { UserCard } from './UserCard'
import { LoadMore } from './LoadMore'
import { useCursorPages } from './useCursorPages'

/**
 * Staff listing with cursor-based "Load more". The first page arrives from
 * the server render; subsequent pages come from `/api/admin/users`.
 */
export function UserList({
  initialPage,
  query,
  units,
}: {
  initialPage: Paginated<User>
  /** Active filters, repeated on every follow-up page request. */
  query: Record<string, string | undefined>
  units: PublicBusinessUnit[]
}) {
  const t = useTranslations('admin.users')
  const { items, hasMore, loading, error, loadMore } = useCursorPages<User>({
    endpoint: '/api/admin/users',
    query,
    initialPage,
  })

  const unitsById = new Map(units.map((u) => [u.id, u]))
  const unitFor = (user: User) =>
    user.businessUnitIds[0]
      ? (unitsById.get(user.businessUnitIds[0]) ?? null)
      : null

  // Belt and braces: the data layer already refuses to hand back an empty
  // page while more remain, but if one ever slips through, the empty state
  // must not swallow the only control that could reach the rest.
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            👤
          </span>
          <p className="text-fg-muted">{t('empty')}</p>
        </div>
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
        {items.map((u) => (
          <UserCard key={u.id} user={u} unit={unitFor(u)} />
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                <th className="px-4 py-3 font-medium">{t('tableRole')}</th>
                <th className="px-4 py-3 font-medium">{t('tableUnit')}</th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <UserRow key={u.id} user={u} unit={unitFor(u)} />
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
