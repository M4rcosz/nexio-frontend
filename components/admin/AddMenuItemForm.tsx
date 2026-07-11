'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'

type ProductOption = { id: string; name: string }

const MONEY_RE = /^\d+(\.\d{1,2})?$/

/**
 * Adds a product to a unit's menu (ADMIN/MANAGER, unit-scoped). Every product is
 * offered in the Select — a product already on the menu is handled server-side
 * with a friendly 409, not filtered out here.
 */
export function AddMenuItemForm({
  businessUnitId,
  products,
}: {
  businessUnitId: string
  products: ProductOption[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.menu.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    productId: products[0]?.id ?? '',
    customPrice: '',
    isAvailable: true,
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const customPrice = form.customPrice.trim()
    if (!MONEY_RE.test(customPrice) || Number(customPrice) <= 0) {
      setError(t('invalidMoney'))
      return
    }

    start(async () => {
      const res = await fetch(`/api/business-units/${businessUnitId}/menu`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          customPrice,
          isAvailable: form.isAvailable,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        if (data?.code === 'menu_item_exists') setError(t('alreadyOnMenu'))
        else setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      setSuccess(t('success'))
      setForm((s) => ({ ...s, customPrice: '', isAvailable: true }))
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="menu-product">
            {t('product')}
          </label>
          <Select
            id="menu-product"
            value={form.productId}
            onChange={(v) => update('productId', v)}
            ariaLabel={t('product')}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="menu-price">
            {t('customPrice')}
          </label>
          <input
            id="menu-price"
            className="input"
            inputMode="decimal"
            required
            placeholder="58.90"
            value={form.customPrice}
            onChange={(e) => update('customPrice', e.target.value)}
          />
          <p className="mt-1 text-xs text-fg-subtle">{t('priceHint')}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.isAvailable}
          onChange={(e) => update('isAvailable', e.target.checked)}
        />
        {t('isAvailable')}
      </label>

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
