'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { clientFetch } from '@/lib/api/client'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { canCancel, forwardStatuses } from '@/lib/orders/statusMachine'
import { shortOrderRef } from '@/lib/orders/orderRef'
import type {
  Order,
  OrderChannel,
  OrderSortField,
  OrderStatus,
  Paginated,
  PublicBusinessUnit,
  SortDirection,
} from '@/lib/api/types'

const CHANNELS: OrderChannel[] = ['APP', 'WEB', 'TOTEM', 'COUNTER', 'PICKUP']
const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]

type Filters = {
  channel: OrderChannel | ''
  status: OrderStatus | ''
  businessUnitId: string
  attendantId: string
  customerId: string
  createdAtFrom: string // yyyy-mm-dd, local date input value
  createdAtTo: string // yyyy-mm-dd
  minTotal: string
  maxTotal: string
}

const EMPTY_FILTERS: Filters = {
  channel: '',
  status: '',
  businessUnitId: '',
  attendantId: '',
  customerId: '',
  createdAtFrom: '',
  createdAtTo: '',
  minTotal: '',
  maxTotal: '',
}

type Meta = Paginated<Order>['meta']

/** Merge a new page into the current list, dropping ids already present. */
function mergeUnique(current: Order[], incoming: Order[]): Order[] {
  const seen = new Set(current.map((o) => o.id))
  const next = [...current]
  for (const o of incoming) {
    if (!seen.has(o.id)) {
      seen.add(o.id)
      next.push(o)
    }
  }
  return next
}

function toQuery(
  filters: Filters,
  sortBy: OrderSortField,
  sortDir: SortDirection,
) {
  return {
    orderChannel: filters.channel || undefined,
    orderStatus: filters.status || undefined,
    businessUnitId: filters.businessUnitId || undefined,
    attendantId: filters.attendantId.trim() || undefined,
    customerId: filters.customerId.trim() || undefined,
    // A day picker is instants-unaware; the API treats createdAtTo as an
    // instant, so "through <date>" means end-of-day, not midnight.
    createdAtFrom: filters.createdAtFrom
      ? `${filters.createdAtFrom}T00:00:00.000Z`
      : undefined,
    createdAtTo: filters.createdAtTo
      ? `${filters.createdAtTo}T23:59:59.999Z`
      : undefined,
    minTotal: filters.minTotal.trim() || undefined,
    maxTotal: filters.maxTotal.trim() || undefined,
    sortBy,
    sortDir,
  }
}

export function OrderBoard({
  initial,
  units,
  showUnitFilter,
}: {
  initial: Paginated<Order>
  units: PublicBusinessUnit[]
  showUnitFilter: boolean
}) {
  const t = useTranslations('admin.orders')
  const tStatus = useTranslations('orderStatus')
  const tChannel = useTranslations('orderChannel')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [orders, setOrders] = useState<Order[]>(initial.data)
  const [meta, setMeta] = useState<Meta>(initial.meta)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState<OrderSortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [rowPending, setRowPending] = useState<Record<string, boolean>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})
  // Guards against a stale response overwriting a newer filter/sort selection.
  const requestId = useRef(0)

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])

  const fetchPage = useCallback(
    async (
      f: Filters,
      by: OrderSortField,
      dir: SortDirection,
      cursor?: string,
    ) => {
      return clientFetch<Paginated<Order>>('/api/admin/orders', {
        query: { limit: 20, cursor, ...toQuery(f, by, dir) },
      })
    },
    [],
  )

  // Reload page 1 whenever a filter or the sort changes — the cursor is
  // sort-bound, so it must never survive a filter/sort change (backend 422s).
  const mounted = useRef(false)
  const depsKey = JSON.stringify({ filters, sortBy, sortDir })
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setListError(null)
    fetchPage(filters, sortBy, sortDir)
      .then((page) => {
        if (id !== requestId.current) return
        setOrders(page.data)
        setMeta(page.meta)
      })
      .catch((err) => {
        if (id !== requestId.current) return
        setOrders([])
        setMeta({ limit: 20, nextCursor: null, hasMore: false })
        setListError(
          errorMessage(err?.body?.code, err?.status) ?? t('loadFailed'),
        )
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  async function loadMore() {
    if (!meta.hasMore || !meta.nextCursor || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const page = await fetchPage(filters, sortBy, sortDir, meta.nextCursor)
      if (id !== requestId.current) return
      setOrders((cur) => mergeUnique(cur, page.data))
      setMeta(page.meta)
    } catch {
      // keep current list; the button stays available for a retry
    } finally {
      setLoadingMore(false)
    }
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function applyKitchenQueue() {
    setFilters({ ...EMPTY_FILTERS, status: 'PREPARING' })
    setSortBy('createdAt')
    setSortDir('asc')
  }

  async function refetchOrder(id: string) {
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
      if (!res.ok) return
      const fresh = (await res.json()) as Order
      setOrders((cur) => cur.map((o) => (o.id === id ? fresh : o)))
    } catch {
      // leave the stale row in place; the next mutation attempt will retry
    }
  }

  async function withRow(id: string, action: () => Promise<Response>) {
    setRowPending((p) => ({ ...p, [id]: true }))
    setRowError((e) => {
      if (!(id in e)) return e
      const rest = { ...e }
      delete rest[id]
      return rest
    })
    try {
      const res = await action()
      if (res.ok) {
        const updated = (await res.json()) as Order
        setOrders((cur) => cur.map((o) => (o.id === id ? updated : o)))
        return
      }
      const body = (await res.json().catch(() => null)) as {
        code?: string
      } | null
      if (res.status === 409) {
        await refetchOrder(id)
      }
      setRowError((e) => ({
        ...e,
        [id]: errorMessage(body?.code, res.status) ?? t('actionFailed'),
      }))
    } catch {
      setRowError((e) => ({ ...e, [id]: t('actionFailed') }))
    } finally {
      setRowPending((p) => ({ ...p, [id]: false }))
    }
  }

  function advance(order: Order, next: OrderStatus) {
    void withRow(order.id, () =>
      fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderStatus: next }),
      }),
    )
  }

  function cancel(order: Order) {
    void withRow(order.id, () =>
      fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' }),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('filters.channel')}>
          <Select
            fullWidth={false}
            ariaLabel={t('filters.channel')}
            value={filters.channel}
            onChange={(v) => setFilter('channel', v as OrderChannel | '')}
            options={[
              { value: '', label: t('filters.allChannels') },
              ...CHANNELS.map((c) => ({ value: c, label: tChannel(c) })),
            ]}
          />
        </Field>
        <Field label={t('filters.status')}>
          <Select
            fullWidth={false}
            ariaLabel={t('filters.status')}
            value={filters.status}
            onChange={(v) => setFilter('status', v as OrderStatus | '')}
            options={[
              { value: '', label: t('filters.allStatuses') },
              ...STATUSES.map((s) => ({ value: s, label: tStatus(s) })),
            ]}
          />
        </Field>
        {showUnitFilter ? (
          <Field label={t('filters.unit')}>
            <Select
              fullWidth={false}
              ariaLabel={t('filters.unit')}
              value={filters.businessUnitId}
              onChange={(v) => setFilter('businessUnitId', v)}
              options={[
                { value: '', label: t('filters.allUnits') },
                ...units.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </Field>
        ) : null}

        <MoreFiltersPopover
          filters={filters}
          setFilter={setFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortDir={sortDir}
          setSortDir={setSortDir}
        />

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={applyKitchenQueue}
            className="btn-ghost"
          >
            {t('filters.kitchenQueue')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setSortBy('createdAt')
              setSortDir('desc')
            }}
            className="btn-ghost"
          >
            {t('filters.clear')}
          </button>
        </div>
      </div>

      {listError ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {listError}
        </p>
      ) : null}

      {orders.length === 0 && !loading ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🧾
          </span>
          <p className="text-fg-muted">{t('noResults')}</p>
        </div>
      ) : (
        <div
          className={`card overflow-hidden p-0 ${loading ? 'opacity-50' : ''}`}
          aria-busy={loading}
        >
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">
                    {t('table.order')}
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">
                    {t('table.status')}
                  </th>
                  {showUnitFilter ? (
                    <th className="whitespace-nowrap px-3 py-3 font-medium">
                      {t('table.unit')}
                    </th>
                  ) : null}
                  <th className="whitespace-nowrap px-3 py-3 font-medium">
                    {t('table.who')}
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                    {t('table.total')}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const forwards = forwardStatuses(order.orderStatus)
                  const pending = !!rowPending[order.id]
                  const unit = unitsById.get(order.businessUnitId)
                  return (
                    <tr
                      key={order.id}
                      className="border-t border-border align-middle"
                    >
                      <td className="px-3 py-3">
                        {/* The raw uuid wrapped over three lines and told the
                            operator nothing; the short ref is the scannable
                            handle, full id on hover for support lookups. */}
                        <p
                          title={order.id}
                          className="whitespace-nowrap font-mono text-xs font-medium text-fg"
                        >
                          #{shortOrderRef(order.id)}
                        </p>
                        {/* Date and channel on their own lines: as one nowrap
                            run this was the widest cell in the table and forced
                            the whole board to scroll sideways. */}
                        <p className="mt-0.5 whitespace-nowrap text-xs text-fg-muted">
                          {formatDateTime(order.createdAt, locale)}
                        </p>
                        <p className="whitespace-nowrap text-[11px] text-fg-subtle">
                          {tChannel(order.orderChannel)}
                        </p>
                        {rowError[order.id] ? (
                          <p
                            role="alert"
                            className="mt-1 text-xs text-accent-600 dark:text-accent-400"
                          >
                            {rowError[order.id]}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="chip whitespace-nowrap">
                          {tStatus(order.orderStatus)}
                        </span>
                      </td>
                      {showUnitFilter ? (
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-fg-muted">
                          {unit?.name ?? order.businessUnitId}
                        </td>
                      ) : null}
                      <td className="max-w-[220px] px-3 py-3 text-xs text-fg-muted">
                        {order.customerName ? (
                          <p className="truncate font-medium text-fg">
                            {order.customerName}
                          </p>
                        ) : null}
                        {order.attendantId ? (
                          <p
                            title={order.attendantId}
                            className="whitespace-nowrap"
                          >
                            {t('table.attendantOf', {
                              id: shortOrderRef(order.attendantId),
                            })}
                          </p>
                        ) : null}
                        {order.customerId ? (
                          <p
                            title={order.customerId}
                            className="whitespace-nowrap"
                          >
                            {t('table.customerOf', {
                              id: shortOrderRef(order.customerId),
                            })}
                          </p>
                        ) : null}
                        {!order.customerName &&
                        !order.attendantId &&
                        !order.customerId
                          ? '—'
                          : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-fg">
                        {formatMoney(order.totalAmount, locale)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-nowrap justify-end gap-1.5">
                          {forwards.map((next) => (
                            <button
                              key={next}
                              type="button"
                              disabled={pending}
                              onClick={() => advance(order, next)}
                              className="btn-secondary whitespace-nowrap px-2.5 py-1 text-xs"
                            >
                              {t(`actions.${next}`)}
                            </button>
                          ))}
                          {canCancel(order.orderStatus, 'staff') ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => cancel(order)}
                              className="btn-danger px-2.5 py-1 text-xs"
                            >
                              {t('actions.cancel')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
        {label}
      </span>
      {children}
    </div>
  )
}

/** Secondary filters (attendant/customer/date range/totals/sort), tucked
 * behind a popover so the primary bar (channel, status, unit) stays scannable. */
function MoreFiltersPopover({
  filters,
  setFilter,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
}: {
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  sortBy: OrderSortField
  setSortBy: (v: OrderSortField) => void
  sortDir: SortDirection
  setSortDir: (v: SortDirection) => void
}) {
  const t = useTranslations('admin.orders')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const activeCount = [
    filters.attendantId.trim(),
    filters.customerId.trim(),
    filters.createdAtFrom,
    filters.createdAtTo,
    filters.minTotal.trim(),
    filters.maxTotal.trim(),
  ].filter(Boolean).length

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="btn-secondary"
      >
        {activeCount > 0
          ? t('filters.moreFiltersCount', { count: activeCount })
          : t('filters.moreFilters')}
        <ChevronDown
          className={`h-4 w-4 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('filters.moreFiltersPanelLabel')}
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-border bg-bg-elevated p-4 shadow-soft-lg sm:w-[min(90vw,420px)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {t('filters.moreFiltersPanelLabel')}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('filters.closeFilters')}
              className="-mr-1.5 rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('filters.attendant')}>
              <input
                className="input"
                placeholder={t('filters.attendantPlaceholder')}
                value={filters.attendantId}
                onChange={(e) => setFilter('attendantId', e.target.value)}
              />
            </Field>
            <Field label={t('filters.customer')}>
              <input
                className="input"
                placeholder={t('filters.customerPlaceholder')}
                value={filters.customerId}
                onChange={(e) => setFilter('customerId', e.target.value)}
              />
            </Field>
            <Field label={t('filters.from')}>
              <input
                type="date"
                className="input"
                value={filters.createdAtFrom}
                onChange={(e) => setFilter('createdAtFrom', e.target.value)}
              />
            </Field>
            <Field label={t('filters.to')}>
              <input
                type="date"
                className="input"
                value={filters.createdAtTo}
                onChange={(e) => setFilter('createdAtTo', e.target.value)}
              />
            </Field>
            <Field label={t('filters.minTotal')}>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={filters.minTotal}
                onChange={(e) => setFilter('minTotal', e.target.value)}
              />
            </Field>
            <Field label={t('filters.maxTotal')}>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={filters.maxTotal}
                onChange={(e) => setFilter('maxTotal', e.target.value)}
              />
            </Field>
            <Field label={t('filters.sortBy')}>
              <Select
                ariaLabel={t('filters.sortBy')}
                value={sortBy}
                onChange={(v) => setSortBy(v as OrderSortField)}
                options={[
                  { value: 'createdAt', label: t('filters.sortCreatedAt') },
                  { value: 'totalAmount', label: t('filters.sortTotal') },
                ]}
              />
            </Field>
            <Field label={t('filters.sortDir')}>
              <Select
                ariaLabel={t('filters.sortDir')}
                value={sortDir}
                onChange={(v) => setSortDir(v as SortDirection)}
                options={[
                  { value: 'desc', label: t('filters.sortDesc') },
                  { value: 'asc', label: t('filters.sortAsc') },
                ]}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
