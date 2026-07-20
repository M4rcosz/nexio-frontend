'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { Link } from '@/i18n/navigation'
import { formatMoney } from '@/lib/money'
import { shortOrderRef } from '@/lib/orders/orderRef'
import { CreateOrderForm } from './CreateOrderForm'
import type {
  Order,
  OrderChannel,
  Paginated,
  PublicBusinessUnit,
  PublicMenuItem,
} from '@/lib/api/types'

/** COUNTER and PICKUP share identical field requirements (doc §3), so a single
 * form handles both behind a channel toggle. */
const POS_CHANNELS: OrderChannel[] = ['COUNTER', 'PICKUP']

export function PosBoard({
  units,
  initialUnitId,
  initialProducts,
}: {
  units: PublicBusinessUnit[]
  initialUnitId: string
  initialProducts: PublicMenuItem[]
}) {
  const t = useTranslations('pos')
  const tChannel = useTranslations('orderChannel')
  const locale = useLocale()

  const [unitId, setUnitId] = useState(initialUnitId)
  const [channel, setChannel] = useState<OrderChannel>('COUNTER')
  const [products, setProducts] = useState<PublicMenuItem[]>(initialProducts)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [menuError, setMenuError] = useState(false)
  const [placed, setPlaced] = useState<Order | null>(null)
  const requestId = useRef(0)

  const loadMenu = useCallback(async (id: string) => {
    const reqId = ++requestId.current
    setLoadingProducts(true)
    setMenuError(false)
    try {
      const res = await fetch(`/api/business-units/${id}/menu`, {
        cache: 'no-store',
      })
      const body = (await res.json().catch(() => null)) as
        | Paginated<PublicMenuItem>
        | { data?: PublicMenuItem[]; error?: string }
        | null
      if (reqId !== requestId.current) return
      // The proxy route degrades a backend failure to a 200 with `{ error, data:
      // [] }`, so an empty `data` alone is ambiguous — treat a non-ok status or a
      // present `error` field as a load failure, distinct from an empty menu.
      const failed =
        !res.ok || (body != null && 'error' in body && Boolean(body.error))
      if (failed) {
        setMenuError(true)
        setProducts([])
        return
      }
      setProducts(Array.isArray(body?.data) ? body.data : [])
    } catch {
      if (reqId === requestId.current) {
        setMenuError(true)
        setProducts([])
      }
    } finally {
      if (reqId === requestId.current) setLoadingProducts(false)
    }
  }, [])

  // Reload the menu when the attendant switches unit (skip the initial render —
  // the server already provided the first unit's menu).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    void loadMenu(unitId)
  }, [unitId, loadMenu])

  if (placed) {
    return (
      <div className="card space-y-4 p-8 text-center">
        <span className="text-5xl" aria-hidden>
          ✅
        </span>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('orderPlaced')}
          </p>
          {/* The call-token is the customer's name; the raw id is only a muted,
              secondary reference (the backend provides no friendly number). */}
          {placed.customerName ? (
            <p className="mt-1 font-display text-2xl font-bold text-fg">
              {placed.customerName}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-fg-subtle">
            {t('orderRef', { ref: shortOrderRef(placed.id) })}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-gradient-brand">
            {formatMoney(placed.totalAmount, locale)}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setPlaced(null)}
          >
            {t('newOrder')}
          </button>
          <Link href={`/orders/${placed.id}`} className="btn-ghost">
            {t('viewOrder')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {units.length > 1 ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
              {t('unit')}
            </span>
            <Select
              fullWidth={false}
              ariaLabel={t('unit')}
              value={unitId}
              onChange={setUnitId}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
            {t('channel')}
          </span>
          <Select
            fullWidth={false}
            ariaLabel={t('channel')}
            value={channel}
            onChange={(v) => setChannel(v as OrderChannel)}
            options={POS_CHANNELS.map((c) => ({
              value: c,
              label: tChannel(c),
            }))}
          />
        </label>
      </div>

      <CreateOrderForm
        // Reset all form state when the unit or channel changes.
        key={`${unitId}:${channel}`}
        channel={channel}
        businessUnitId={unitId}
        products={products}
        loadingProducts={loadingProducts}
        menuError={menuError}
        onReloadMenu={() => loadMenu(unitId)}
        onPlaced={setPlaced}
      />
    </div>
  )
}
