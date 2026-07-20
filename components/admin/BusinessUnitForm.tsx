'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { useRouter } from '@/i18n/navigation'
import { cnpjDigits, maskCnpj } from '@/lib/format'
import { buildBusinessUnitPatch } from '@/lib/admin/buildPatch'
import type { BusinessUnit, CreateBusinessUnitRequest } from '@/lib/api/types'

type Mode = 'create' | 'edit'

/**
 * Create/edit form for a business unit (ADMIN only). On create, all five fields
 * are sent and the cnpj mask is stripped to its 14 digits. On edit, cnpj is
 * read-only (immutable) and the PATCH carries only the fields that actually
 * changed — an unchanged field is an absent key, never null or "".
 */
export function BusinessUnitForm({
  mode,
  unit,
}: {
  mode: Mode
  unit?: BusinessUnit
}) {
  const router = useRouter()
  const t = useTranslations('admin.businessUnits.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: unit?.name ?? '',
    cnpj: unit ? maskCnpj(unit.cnpj) : '',
    address: unit?.address ?? '',
    city: unit?.city ?? '',
    phone: unit?.phone ?? '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'create') {
      const name = form.name.trim()
      if (name.length < 2) {
        setError(t('invalidName'))
        return
      }
      const cnpj = cnpjDigits(form.cnpj)
      if (cnpj.length !== 14) {
        setError(t('invalidCnpj'))
        return
      }
      const address = form.address.trim()
      const city = form.city.trim()
      const phone = form.phone.trim()
      if (address.length < 2 || city.length < 2 || phone.length < 3) {
        setError(t('invalidFields'))
        return
      }
      const body: CreateBusinessUnitRequest = {
        name,
        cnpj,
        address,
        city,
        phone,
      }
      start(async () => {
        const res = await fetch('/api/business-units', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            code?: string
          } | null
          setError(errorMessage(data?.code, res.status) ?? t('failed'))
          return
        }
        // Refresh before navigating: a refresh queued after push races the
        // pending navigation and can be dropped, leaving the cached list.
        router.refresh()
        router.push('/admin/business-units')
      })
      return
    }

    const result = buildBusinessUnitPatch(form, unit!)
    if ('error' in result) {
      setError(t(result.error))
      return
    }

    start(async () => {
      const res = await fetch(`/api/business-units/${unit!.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result.patch),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      router.refresh()
      router.push('/admin/business-units')
    })
  }

  // In edit mode, disable the submit until something actually changed.
  const dirty =
    mode === 'create'
      ? true
      : form.name.trim() !== unit!.name ||
        form.address.trim() !== unit!.address ||
        form.city.trim() !== unit!.city ||
        form.phone.trim() !== unit!.phone

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="bu-name">
          {t('name')}
        </label>
        <input
          id="bu-name"
          className="input"
          required
          minLength={2}
          maxLength={120}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="bu-cnpj">
          {t('cnpj')}
        </label>
        <input
          id="bu-cnpj"
          className="input"
          inputMode="numeric"
          readOnly={mode === 'edit'}
          disabled={mode === 'edit'}
          required={mode === 'create'}
          placeholder="00.000.000/0000-00"
          value={form.cnpj}
          onChange={(e) => update('cnpj', maskCnpj(e.target.value))}
        />
        <p className="mt-1 text-xs text-fg-subtle">
          {mode === 'edit' ? t('cnpjImmutableHint') : t('cnpjHint')}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="bu-address">
          {t('address')}
        </label>
        <input
          id="bu-address"
          className="input"
          required
          minLength={2}
          maxLength={200}
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="bu-city">
          {t('city')}
        </label>
        <input
          id="bu-city"
          className="input"
          required
          minLength={2}
          maxLength={120}
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="bu-phone">
          {t('phone')}
        </label>
        <input
          id="bu-phone"
          className="input"
          required
          minLength={3}
          maxLength={30}
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
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
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || !dirty}
        >
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
