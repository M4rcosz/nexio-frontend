'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'
import type { InventoryAdjustmentType } from '@/lib/api/types'

type ProductOption = { id: string; name: string }

export function AdjustStockForm({
  businessUnitId,
  products,
}: {
  businessUnitId: string
  products: ProductOption[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.inventory.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    productId: products[0]?.id ?? '',
    type: 'IN' as InventoryAdjustmentType,
    quantity: 1,
    reason: '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError(t('invalidQuantity'))
      return
    }
    start(async () => {
      const res = await fetch(
        `/api/inventory/${businessUnitId}/adjust`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: form.productId,
            type: form.type,
            quantity,
            reason: form.reason,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null
        if (data?.code === 'inventory_not_found') setError(t('notFound'))
        else if (data?.code === 'inventory_below_zero') setError(t('belowZero'))
        else setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      setSuccess(t('success'))
      setForm((s) => ({ ...s, quantity: 1, reason: '' }))
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="adjust-product">
            {t('product')}
          </label>
          <Select
            id="adjust-product"
            value={form.productId}
            onChange={(v) => update('productId', v)}
            ariaLabel={t('product')}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="adjust-type">
            {t('type')}
          </label>
          <Select
            id="adjust-type"
            value={form.type}
            onChange={(v) => update('type', v as InventoryAdjustmentType)}
            ariaLabel={t('type')}
            options={[
              { value: 'IN', label: t('typeIn') },
              { value: 'OUT', label: t('typeOut') },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="adjust-qty">
            {t('quantity')}
          </label>
          <input
            id="adjust-qty"
            type="number"
            min={1}
            step={1}
            className="input"
            required
            value={form.quantity}
            onChange={(e) => update('quantity', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label" htmlFor="adjust-reason">
            {t('reason')}
          </label>
          <input
            id="adjust-reason"
            className="input"
            required
            placeholder={t('reasonPlaceholder')}
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
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
