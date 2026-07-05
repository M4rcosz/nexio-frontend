'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'
import type {
  Promotion,
  PromotionDiscountType,
  PublicBusinessUnit,
} from '@/lib/api/types'

type Mode = 'create' | 'edit'

const MONEY_RE = /^\d+(\.\d{1,2})?$/

/** ISO string → value for <input type="datetime-local"> (local, no seconds). */
function toLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

function toIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function PromotionForm({
  mode,
  promotion,
  units,
  scopedBusinessUnitId,
}: {
  mode: Mode
  promotion?: Promotion
  units: PublicBusinessUnit[]
  /** When set, the unit field is locked to this unit (MANAGER scope). */
  scopedBusinessUnitId: string | null
}) {
  const router = useRouter()
  const t = useTranslations('admin.promotions.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const unitLocked = scopedBusinessUnitId !== null

  const [form, setForm] = useState({
    businessUnitId:
      promotion?.businessUnitId ?? scopedBusinessUnitId ?? units[0]?.id ?? '',
    name: promotion?.name ?? '',
    discountType: (promotion?.discountType ?? 'PERCENTAGE') as PromotionDiscountType,
    discountValue: promotion?.discountValue ?? '',
    minOrderValue: promotion?.minOrderValue ?? '',
    startDate: promotion ? toLocalInput(promotion.startDate) : '',
    endDate: promotion ? toLocalInput(promotion.endDate) : '',
    isActive: promotion?.isActive ?? true,
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!MONEY_RE.test(form.discountValue) || !MONEY_RE.test(form.minOrderValue)) {
      setError(t('invalidMoney'))
      return
    }
    if (
      form.discountType === 'PERCENTAGE' &&
      Number(form.discountValue) > 100
    ) {
      setError(t('invalidPercentage'))
      return
    }
    const startIso = toIso(form.startDate)
    const endIso = toIso(form.endDate)
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setError(t('invalidDates'))
      return
    }

    start(async () => {
      const isCreate = mode === 'create'
      const url = isCreate
        ? '/api/promotions'
        : `/api/promotions/${promotion!.id}`
      const method = isCreate ? 'POST' : 'PATCH'
      const businessUnitId = scopedBusinessUnitId ?? form.businessUnitId
      const body = isCreate
        ? {
            businessUnitId,
            name: form.name,
            discountType: form.discountType,
            discountValue: form.discountValue,
            minOrderValue: form.minOrderValue,
            startDate: startIso,
            endDate: endIso,
            isActive: form.isActive,
          }
        : {
            name: form.name,
            discountType: form.discountType,
            discountValue: form.discountValue,
            minOrderValue: form.minOrderValue,
            startDate: startIso,
            endDate: endIso,
            isActive: form.isActive,
          }
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { code?: string }
          | null
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      router.push('/admin/promotions')
      router.refresh()
    })
  }

  const isPercentage = form.discountType === 'PERCENTAGE'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-name">
            {t('name')}
          </label>
          <input
            id="promo-name"
            className="input"
            required
            minLength={2}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="promo-unit">
            {t('unit')}
          </label>
          <Select
            id="promo-unit"
            disabled={unitLocked || mode === 'edit'}
            value={scopedBusinessUnitId ?? form.businessUnitId}
            onChange={(v) => update('businessUnitId', v)}
            ariaLabel={t('unit')}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
          {unitLocked ? (
            <p className="mt-1 text-xs text-fg-subtle">{t('unitLocked')}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-type">
            {t('discountType')}
          </label>
          <Select
            id="promo-type"
            value={form.discountType}
            onChange={(v) => update('discountType', v as PromotionDiscountType)}
            ariaLabel={t('discountType')}
            options={[
              { value: 'PERCENTAGE', label: t('discountTypePercentage') },
              { value: 'FIXED_AMOUNT', label: t('discountTypeFixed') },
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="promo-value">
            {t('discountValue')}
          </label>
          <input
            id="promo-value"
            className="input"
            required
            inputMode="decimal"
            placeholder="10.00"
            value={form.discountValue}
            onChange={(e) => update('discountValue', e.target.value)}
          />
          <p className="mt-1 text-xs text-fg-subtle">
            {isPercentage
              ? t('discountValueHintPercentage')
              : t('discountValueHintFixed')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-min">
            {t('minOrderValue')}
          </label>
          <input
            id="promo-min"
            className="input"
            required
            inputMode="decimal"
            placeholder="30.00"
            value={form.minOrderValue}
            onChange={(e) => update('minOrderValue', e.target.value)}
          />
          <p className="mt-1 text-xs text-fg-subtle">{t('minOrderHint')}</p>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
            />
            {t('isActive')}
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-start">
            {t('startDate')}
          </label>
          <input
            id="promo-start"
            type="datetime-local"
            className="input"
            required
            value={form.startDate}
            onChange={(e) => update('startDate', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="promo-end">
            {t('endDate')}
          </label>
          <input
            id="promo-end"
            type="datetime-local"
            className="input"
            required
            value={form.endDate}
            onChange={(e) => update('endDate', e.target.value)}
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending
            ? t('submitting')
            : mode === 'create'
              ? t('submitCreate')
              : t('submitEdit')}
        </button>
      </div>
    </form>
  )
}
