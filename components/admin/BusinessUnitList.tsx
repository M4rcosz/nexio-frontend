'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { clientFetch } from '@/lib/api/client'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatDateTime, maskCnpj } from '@/lib/format'
import type { BusinessUnit, Paginated } from '@/lib/api/types'

type Meta = Paginated<BusinessUnit>['meta']

export type BusinessUnitListFilters = {
  search?: string
  city?: string
  isActive?: boolean
}

/** Merge a new page into the current list, dropping ids already present. */
function mergeUnique(
  current: BusinessUnit[],
  incoming: BusinessUnit[],
): BusinessUnit[] {
  const seen = new Set(current.map((u) => u.id))
  const next = [...current]
  for (const u of incoming) {
    if (!seen.has(u.id)) {
      seen.add(u.id)
      next.push(u)
    }
  }
  return next
}

export function BusinessUnitList({
  initial,
  filters,
}: {
  initial: Paginated<BusinessUnit>
  filters: BusinessUnitListFilters
}) {
  const t = useTranslations('admin.businessUnits')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [units, setUnits] = useState<BusinessUnit[]>(initial.data)
  const [meta, setMeta] = useState<Meta>(initial.meta)
  const [loadingMore, setLoadingMore] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{
    id: string
    message: string
  } | null>(null)

  async function loadMore() {
    if (!meta.hasMore || !meta.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await clientFetch<Paginated<BusinessUnit>>(
        '/api/business-units',
        {
          query: {
            limit: 20,
            cursor: meta.nextCursor,
            search: filters.search,
            city: filters.city,
            isActive:
              typeof filters.isActive === 'boolean'
                ? String(filters.isActive)
                : undefined,
          },
        },
      )
      setUnits((cur) => mergeUnique(cur, page.data))
      setMeta(page.meta)
    } catch {
      // keep current list; the button stays available for a retry
    } finally {
      setLoadingMore(false)
    }
  }

  async function toggleActive(unit: BusinessUnit) {
    const next = !unit.isActive
    if (!next) {
      const ok = window.confirm(t('confirmDisable'))
      if (!ok) return
    }
    setRowError(null)
    setTogglingId(unit.id)
    // Optimistic flip; revert on failure.
    setUnits((cur) =>
      cur.map((u) => (u.id === unit.id ? { ...u, isActive: next } : u)),
    )
    try {
      const res = await fetch(`/api/business-units/${unit.id}/active`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        setUnits((cur) =>
          cur.map((u) => (u.id === unit.id ? { ...u, isActive: !next } : u)),
        )
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setRowError({
          id: unit.id,
          message: errorMessage(body?.code, res.status) ?? t('actionFailed'),
        })
      }
    } catch {
      setUnits((cur) =>
        cur.map((u) => (u.id === unit.id ? { ...u, isActive: !next } : u)),
      )
      setRowError({ id: unit.id, message: t('actionFailed') })
    } finally {
      setTogglingId(null)
    }
  }

  if (units.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🏪
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  function StatusBadge({ active }: { active: boolean }) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          active
            ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
            : 'bg-surface-2 text-fg-subtle'
        }`}
      >
        {active ? t('statusActive') : t('statusInactive')}
      </span>
    )
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {units.map((u) => (
          <div key={u.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-fg">{u.name}</p>
              <StatusBadge active={u.isActive} />
            </div>
            <dl className="space-y-1 text-sm text-fg-muted">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-subtle">{t('tableCnpj')}</dt>
                <dd className="font-mono text-xs">{maskCnpj(u.cnpj)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-subtle">{t('tableCity')}</dt>
                <dd>{u.city}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-subtle">{t('tablePhone')}</dt>
                <dd>{u.phone}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/admin/business-units/${u.id}`}
                className="btn-ghost flex-1 justify-center text-xs"
              >
                {t('actionEdit')}
              </Link>
              <button
                type="button"
                onClick={() => toggleActive(u)}
                disabled={togglingId === u.id}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  u.isActive
                    ? 'text-accent-600 hover:bg-accent-500/10'
                    : 'text-forest-600 hover:bg-forest-500/10'
                }`}
              >
                {u.isActive ? t('actionDisable') : t('actionEnable')}
              </button>
            </div>
            {rowError?.id === u.id ? (
              <p role="alert" className="text-xs text-accent-600">
                {rowError.message}
              </p>
            ) : null}
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
                <th className="px-4 py-3 font-medium">{t('tableCnpj')}</th>
                <th className="px-4 py-3 font-medium">{t('tableCity')}</th>
                <th className="px-4 py-3 font-medium">{t('tablePhone')}</th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('tableUpdated')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-fg">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-muted">
                    {maskCnpj(u.cnpj)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{u.city}</td>
                  <td className="px-4 py-3 text-fg-muted">{u.phone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={u.isActive} />
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle">
                    {formatDateTime(u.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/admin/business-units/${u.id}`}
                        className="btn-ghost !px-2 !py-1 text-xs"
                      >
                        {t('actionEdit')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={togglingId === u.id}
                        className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                          u.isActive
                            ? 'text-accent-600 hover:bg-accent-500/10'
                            : 'text-forest-600 hover:bg-forest-500/10'
                        }`}
                      >
                        {u.isActive ? t('actionDisable') : t('actionEnable')}
                      </button>
                    </div>
                    {rowError?.id === u.id ? (
                      <p role="alert" className="mt-1 text-xs text-accent-600">
                        {rowError.message}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {meta.hasMore && meta.nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost"
          >
            {loadingMore ? t('loadingMore') : t('loadMore')}
          </button>
        </div>
      ) : null}
    </>
  )
}
