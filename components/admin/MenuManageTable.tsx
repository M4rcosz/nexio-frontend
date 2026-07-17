'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { MenuItem } from '@/lib/api/types'

const MONEY_RE = /^\d+(\.\d{1,2})?$/

export function MenuManageTable({
  businessUnitId,
  items,
  productNames,
}: {
  businessUnitId: string
  items: MenuItem[]
  /** Map of productId → display name, resolved on the server. */
  productNames: Record<string, string>
}) {
  const t = useTranslations('admin.menu')
  const locale = useLocale()
  const router = useRouter()
  const errorMessage = useErrorMessage()

  const [rows, setRows] = useState<MenuItem[]>(items)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPrice, setDraftPrice] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{
    id: string
    message: string
  } | null>(null)

  // Reconcile with fresh server data after router.refresh() (e.g. a new item
  // added via the form). Optimistic edits below still apply on top until the
  // next refresh brings the persisted truth.
  useEffect(() => {
    setRows(items)
  }, [items])

  async function toggleAvailable(item: MenuItem) {
    const next = !item.isAvailable
    setRowError(null)
    setTogglingId(item.id)
    // Optimistic flip; revert on failure.
    setRows((cur) =>
      cur.map((r) => (r.id === item.id ? { ...r, isAvailable: next } : r)),
    )
    try {
      const res = await fetch(
        `/api/business-units/${businessUnitId}/menu/${item.id}/available`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isAvailable: next }),
        },
      )
      if (!res.ok) {
        setRows((cur) =>
          cur.map((r) => (r.id === item.id ? { ...r, isAvailable: !next } : r)),
        )
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setRowError({
          id: item.id,
          message: errorMessage(body?.code, res.status) ?? t('actionFailed'),
        })
      }
    } catch {
      setRows((cur) =>
        cur.map((r) => (r.id === item.id ? { ...r, isAvailable: !next } : r)),
      )
      setRowError({ id: item.id, message: t('actionFailed') })
    } finally {
      setTogglingId(null)
    }
  }

  function startEdit(item: MenuItem) {
    setRowError(null)
    setEditingId(item.id)
    setDraftPrice(item.customPrice)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftPrice('')
  }

  async function savePrice(item: MenuItem) {
    const price = draftPrice.trim()
    if (!MONEY_RE.test(price) || Number(price) <= 0) {
      setRowError({ id: item.id, message: t('form.invalidMoney') })
      return
    }
    setRowError(null)
    setSavingId(item.id)
    try {
      const res = await fetch(
        `/api/business-units/${businessUnitId}/menu/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ customPrice: price }),
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setRowError({
          id: item.id,
          message: errorMessage(body?.code, res.status) ?? t('actionFailed'),
        })
        return
      }
      const updated = (await res.json()) as MenuItem
      // Merge only the price fields so a concurrent optimistic availability
      // toggle on this row isn't clobbered by the PATCH response.
      setRows((cur) =>
        cur.map((r) =>
          r.id === item.id
            ? {
                ...r,
                customPrice: updated.customPrice,
                updatedAt: updated.updatedAt,
              }
            : r,
        ),
      )
      setEditingId(null)
      setDraftPrice('')
      router.refresh()
    } catch {
      setRowError({ id: item.id, message: t('actionFailed') })
    } finally {
      setSavingId(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          📋
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  function AvailabilityBadge({ available }: { available: boolean }) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          available
            ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
            : 'bg-surface-2 text-fg-subtle'
        }`}
      >
        {available ? t('available') : t('unavailable')}
      </span>
    )
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {rows.map((item) => (
          <div key={item.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate font-semibold text-fg">
                {productNames[item.productId] ?? item.productId}
              </p>
              <AvailabilityBadge available={item.isAvailable} />
            </div>
            <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div className="col-span-2">
                <dt className="font-mono uppercase tracking-widest text-fg-subtle">
                  {t('tablePrice')}
                </dt>
                {editingId === item.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="input !py-1.5 text-sm"
                      inputMode="decimal"
                      placeholder="58.90"
                      aria-label={t('tablePrice')}
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => savePrice(item)}
                      disabled={savingId === item.id}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-2 py-1 text-xs font-medium text-forest-600 hover:bg-forest-500/10 disabled:opacity-50"
                    >
                      {savingId === item.id ? t('saving') : t('save')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <dd className="mt-0.5 font-medium text-fg">
                    {formatMoney(item.customPrice, locale)}
                  </dd>
                )}
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="font-mono uppercase tracking-widest text-fg-subtle">
                  {t('tableUpdated')}
                </dt>
                <dd className="mt-0.5 truncate text-fg-subtle">
                  {formatDateTime(item.updatedAt, locale)}
                </dd>
              </div>
            </dl>
            <div className="flex items-center gap-1.5">
              {editingId === item.id ? null : (
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="btn-ghost flex-1 min-h-[44px] justify-center text-xs"
                >
                  {t('editPrice')}
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleAvailable(item)}
                disabled={togglingId === item.id || editingId === item.id}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  item.isAvailable
                    ? 'text-accent-600 hover:bg-accent-500/10'
                    : 'text-forest-600 hover:bg-forest-500/10'
                }`}
              >
                {item.isAvailable ? t('disable') : t('enable')}
              </button>
            </div>
            {rowError?.id === item.id ? (
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
                <th className="px-4 py-3 font-medium">{t('tableProduct')}</th>
                <th className="px-4 py-3 font-medium">{t('tablePrice')}</th>
                <th className="px-4 py-3 font-medium">
                  {t('tableAvailability')}
                </th>
                <th className="px-4 py-3 font-medium">{t('tableUpdated')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-fg">
                    {productNames[item.productId] ?? item.productId}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input !w-28 !py-1.5 text-sm"
                          inputMode="decimal"
                          placeholder="58.90"
                          value={draftPrice}
                          onChange={(e) => setDraftPrice(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => savePrice(item)}
                          disabled={savingId === item.id}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-forest-600 hover:bg-forest-500/10 disabled:opacity-50"
                        >
                          {savingId === item.id ? t('saving') : t('save')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      formatMoney(item.customPrice, locale)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AvailabilityBadge available={item.isAvailable} />
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle">
                    {formatDateTime(item.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {editingId === item.id ? null : (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="btn-ghost !px-2 !py-1 text-xs"
                        >
                          {t('editPrice')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAvailable(item)}
                        disabled={togglingId === item.id}
                        className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                          item.isAvailable
                            ? 'text-accent-600 hover:bg-accent-500/10'
                            : 'text-forest-600 hover:bg-forest-500/10'
                        }`}
                      >
                        {item.isAvailable ? t('disable') : t('enable')}
                      </button>
                    </div>
                    {rowError?.id === item.id ? (
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
    </>
  )
}
