'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'
import {
  MAX_INVENTORY_QUANTITY,
  REASON_MAX_LENGTH,
} from '@/lib/validation/constants'

type ProductOption = { id: string; name: string }

export type InitPrefill = { productId: string; quantity: number }

/**
 * Opens the first stock row for a product at a unit. On 409 (a row already
 * exists) it steers the operator to the adjustment flow — the common case.
 */
export function InitStockForm({
  businessUnitId,
  products,
  prefill,
  onAdjustRequest,
}: {
  businessUnitId: string
  products: ProductOption[]
  /** Seed values handed over from the adjust form's "not found" CTA. */
  prefill?: InitPrefill | null
  /** Ask the parent to focus the adjustment form for this product (on 409). */
  onAdjustRequest?: (productId: string) => void
}) {
  const router = useRouter()
  const t = useTranslations('admin.inventory.init')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    productId: products[0]?.id ?? '',
    quantity: 0,
    minQuantity: 0,
    reason: '',
  })

  // Apply a prefill handed over from the adjust form's "not found" CTA.
  useEffect(() => {
    if (!prefill) return
    setForm((s) => ({
      ...s,
      productId: prefill.productId || s.productId,
      quantity: prefill.quantity,
    }))
    setExists(false)
    setError(null)
    setSuccess(null)
  }, [prefill])

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExists(false)
    setSuccess(null)
    const quantity = Number(form.quantity)
    const minQuantity = Number(form.minQuantity)
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_INVENTORY_QUANTITY ||
      !Number.isInteger(minQuantity) ||
      minQuantity < 0 ||
      minQuantity > MAX_INVENTORY_QUANTITY
    ) {
      setError(t('invalidQuantity'))
      return
    }
    start(async () => {
      // Never send businessUnitId in the body — the unit comes from the URL.
      const res = await fetch(`/api/inventory/${businessUnitId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          quantity,
          minQuantity,
          reason: form.reason,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          code?: string
        } | null
        if (data?.code === 'inventory_exists') {
          setExists(true)
          return
        }
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      setSuccess(t('success'))
      setForm((s) => ({ ...s, quantity: 0, minQuantity: 0, reason: '' }))
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
      <p className="text-sm text-fg-muted">{t('subtitle')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="init-product">
            {t('product')}
          </label>
          <Select
            id="init-product"
            value={form.productId}
            onChange={(v) => update('productId', v)}
            ariaLabel={t('product')}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="init-reason">
            {t('reason')}
          </label>
          <input
            id="init-reason"
            className="input"
            required
            maxLength={REASON_MAX_LENGTH}
            placeholder={t('reasonPlaceholder')}
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="init-qty">
            {t('quantity')}
          </label>
          <input
            id="init-qty"
            type="number"
            min={0}
            max={MAX_INVENTORY_QUANTITY}
            step={1}
            className="input"
            required
            value={form.quantity}
            onChange={(e) => update('quantity', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label" htmlFor="init-min">
            {t('minQuantity')}
          </label>
          <input
            id="init-min"
            type="number"
            min={0}
            max={MAX_INVENTORY_QUANTITY}
            step={1}
            className="input"
            required
            value={form.minQuantity}
            onChange={(e) => update('minQuantity', Number(e.target.value))}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}
      {exists ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          <p>{t('exists')}</p>
          {onAdjustRequest ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onAdjustRequest(form.productId)}
            >
              {t('goToAdjust')}
            </button>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-forest-500/30 bg-forest-500/10 p-3 text-sm text-forest-700 dark:text-forest-300"
        >
          {success}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  )
}
