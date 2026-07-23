'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadMore } from './LoadMore'
import { useCursorPages } from './useCursorPages'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatDateTime } from '@/lib/format'
import type { AiMembershipUsage, AiUsageReport } from '@/lib/api/types'

/**
 * Turns a `<input type="date">` value into an ISO instant at the given edge of
 * that day **in the viewer's timezone**. Sending a bare `YYYY-MM-DD` would be
 * read as UTC midnight, so an admin in UTC-3 asking for "today" would silently
 * lose the first three hours of it.
 */
function dayBoundary(value: string, edge: 'start' | 'end'): string | undefined {
  if (!value) return undefined
  const local = new Date(
    `${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`,
  )
  return Number.isNaN(local.getTime()) ? undefined : local.toISOString()
}

/**
 * ADMIN report: who holds an AI membership and what they burned in a window.
 *
 * `tokenBalance` and `tokensUsedInPeriod` are independent — a mid-window top-up
 * means they will not reconcile against each other — so the two columns are
 * labelled distinctly rather than presented as parts of one number.
 *
 * This is the only AI response carrying user emails. It stays behind the ADMIN
 * route guard and is never written to logs or analytics.
 */
export function AiUsageReport({
  initialReport,
}: {
  initialReport: AiUsageReport
}) {
  const t = useTranslations('admin.aiUsage')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(initialReport)
  const [applying, setApplying] = useState(false)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // The range page one was actually fetched with — not the live inputs. Editing
  // a date without pressing Apply must not make the next "Load more" walk a
  // cursor from one window using the bounds of another.
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({})

  // Page one lives in state so applying a new range resets `useCursorPages`
  // (it drops appended pages when `initialPage` changes identity) instead of
  // leaving rows from the previous window stacked under the new first page.
  const { items, hasMore, loading, error, loadMore } =
    useCursorPages<AiMembershipUsage>({
      endpoint: '/api/ai/memberships',
      query: applied,
      initialPage: report,
    })

  /** Fetches page one for an already-validated ISO window and installs it. */
  async function load(fromIso?: string, toIso?: string) {
    setApplying(true)
    try {
      const params = new URLSearchParams()
      if (fromIso) params.set('from', fromIso)
      if (toIso) params.set('to', toIso)
      const qs = params.toString()
      const res = await fetch(`/api/ai/memberships${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setRangeError(errorMessage(body?.code, res.status) ?? t('loadFailed'))
        return
      }
      setReport((await res.json()) as AiUsageReport)
      setApplied({ from: fromIso, to: toIso })
    } catch {
      setRangeError(errorMessage(null, 0) ?? t('loadFailed'))
    } finally {
      setApplying(false)
    }
  }

  /** Bounds are passed explicitly so Reset can clear and re-fetch in one go —
   * calling this right after `setFrom('')` would otherwise read the old state. */
  async function apply(nextFrom = from, nextTo = to) {
    const fromIso = dayBoundary(nextFrom, 'start')
    const toIso = dayBoundary(nextTo, 'end')
    // The API answers 422 for an inverted range; catching it here keeps the
    // fix next to the inputs instead of in a banner after a round-trip.
    if (fromIso && toIso && fromIso > toIso) {
      setRangeError(t('invalidRange'))
      return
    }
    setRangeError(null)
    await load(fromIso, toIso)
  }

  // A new `initialReport` identity means the page re-rendered on the server.
  // The manager above calls router.refresh() after every mutation, so this is
  // the path a freshly granted membership takes into the table — without it,
  // page one stays frozen at whatever the first server render returned.
  const [syncedFrom, setSyncedFrom] = useState(initialReport)
  // Held in a ref so the effect below depends on the server render alone, and
  // not on filter state that changes for unrelated reasons.
  const adoptRef = useRef(() => {})
  adoptRef.current = () => {
    // The server always renders its own default window. When the admin has
    // narrowed the range, swapping those rows in would contradict the From/To
    // still on screen — re-fetch the applied window instead.
    if (applied.from || applied.to) void load(applied.from, applied.to)
    else setReport(initialReport)
  }

  useEffect(() => {
    if (syncedFrom === initialReport) return
    setSyncedFrom(initialReport)
    adoptRef.current()
  }, [initialReport, syncedFrom])

  const fmt = (n: number) => n.toLocaleString(locale)

  return (
    <section className="space-y-4">
      <div className="card p-6">
        <h2 className="font-semibold text-fg">{t('title')}</h2>
        {/* The window the server actually applied — not the local inputs, which
            are empty on the default "last 30 days" run. */}
        <p className="mt-1 text-xs text-fg-muted">
          {t('period', {
            from: formatDateTime(report.periodFrom, locale),
            to: formatDateTime(report.periodTo, locale),
          })}
        </p>

        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void apply()
          }}
        >
          <div className="flex w-44 flex-col gap-1 text-xs text-fg-subtle">
            {t('from')}
            <DatePicker
              value={from}
              max={to || undefined}
              onChange={setFrom}
              ariaLabel={t('from')}
            />
          </div>
          <div className="flex w-44 flex-col gap-1 text-xs text-fg-subtle">
            {t('to')}
            <DatePicker
              value={to}
              min={from || undefined}
              onChange={setTo}
              ariaLabel={t('to')}
            />
          </div>
          <button type="submit" disabled={applying} className="btn-primary">
            {applying ? t('applying') : t('apply')}
          </button>
          {from || to ? (
            <button
              type="button"
              disabled={applying}
              onClick={() => {
                setFrom('')
                setTo('')
                setRangeError(null)
                // Empty bounds fall back to the server's last-30-days default.
                void apply('', '')
              }}
              className="btn-secondary"
            >
              {t('reset')}
            </button>
          ) : null}
        </form>

        {rangeError ? (
          <p role="alert" className="mt-3 text-xs text-accent-600">
            {rangeError}
          </p>
        ) : null}
      </div>

      {/* While a new window is being fetched the previous rows stay on screen,
          dimmed and marked busy, rather than being read as the fresh result.
          The empty-state card is suppressed mid-flight so a narrowing filter
          never flashes "no data" before the new page lands. */}
      <div
        className={applying ? 'opacity-50 transition-opacity' : undefined}
        aria-busy={applying || undefined}
      >
        {items.length === 0 && !applying ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <span className="text-5xl" aria-hidden>
              📊
            </span>
            <p className="text-fg-muted">{t('empty')}</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('tableUser')}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t('tableBalance')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t('tableUsed')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('tableStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {/* Both fields are null once the user record stops
                          resolving — show a placeholder, never "null". */}
                        <span className="block font-medium text-fg">
                          {row.userName ?? t('unknownUser')}
                        </span>
                        <span className="block text-xs text-fg-subtle">
                          {row.userEmail ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg">
                        {fmt(row.tokenBalance)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg">
                        {fmt(row.tokensUsedInPeriod)}
                      </td>
                      <td className="px-4 py-3">
                        {row.isRevoked ? (
                          <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-[11px] font-semibold text-accent-700 dark:text-accent-300">
                            {row.revokedAt
                              ? t('revokedOn', {
                                  date: formatDateTime(row.revokedAt, locale),
                                })
                              : t('revoked')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-forest-500/15 px-2.5 py-1 text-[11px] font-semibold text-forest-700 dark:text-forest-300">
                            {t('active')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <LoadMore
        hasMore={hasMore}
        loading={loading}
        error={error}
        loaded={items.length}
        onLoadMore={loadMore}
      />
    </section>
  )
}
