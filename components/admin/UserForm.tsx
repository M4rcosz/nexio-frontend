'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { PasswordInput } from '@/components/PasswordInput'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'
import { useUsernameError } from '@/lib/validation/useUsernameError'
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/lib/validation/constants'
import type { PublicBusinessUnit, Role, User } from '@/lib/api/types'

type Mode = 'create' | 'edit'

const ROLE_LABEL_KEY: Record<Role, string> = {
  ATTENDANT: 'roleAttendant',
  KITCHEN: 'roleKitchen',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
  CUSTOMER: 'roleAttendant', // unused in admin context
}

export function UserForm({
  mode,
  user,
  units,
  scopedBusinessUnitIds,
  manageableRoles,
}: {
  mode: Mode
  user?: User
  units: PublicBusinessUnit[]
  /**
   * MANAGER scope: the unit choices are limited to this set (and seeded from it
   * on create). `null` means the actor is an ADMIN and may assign any unit.
   */
  scopedBusinessUnitIds: string[] | null
  manageableRoles: Role[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.form')
  const errorMessage = useErrorMessage()
  const usernameError = useUsernameError()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Sanitize the user's current role against what the actor can pick.
  const initialRole = useMemo<Role>(() => {
    if (user && manageableRoles.includes(user.role)) return user.role
    return manageableRoles[0] ?? 'ATTENDANT'
  }, [user, manageableRoles])

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    username: user?.username ?? '',
    phone: user?.phone ?? '',
    password: '',
    role: initialRole,
    // Non-ADMIN staff can be bound to several units. Seed from the edited
    // user's set, else pre-select the MANAGER's own units on create.
    businessUnitIds: user?.businessUnitIds ?? scopedBusinessUnitIds ?? [],
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function toggleUnit(id: string) {
    setForm((s) => ({
      ...s,
      businessUnitIds: s.businessUnitIds.includes(id)
        ? s.businessUnitIds.filter((x) => x !== id)
        : [...s.businessUnitIds, id],
    }))
  }

  // Instant, client-side feedback for username validity (create only — the
  // username is immutable on edit).
  const usernameHint = mode === 'create' ? usernameError(form.username) : null

  const isAdminRole = form.role === 'ADMIN'
  // ADMIN role has no unit; for everyone else at least one is required.
  const unitFieldVisible = !isAdminRole
  // A MANAGER may only assign units within their own scope; an ADMIN sees all.
  const selectableUnits = useMemo(
    () =>
      scopedBusinessUnitIds === null
        ? units
        : units.filter((u) => scopedBusinessUnitIds.includes(u.id)),
    [units, scopedBusinessUnitIds],
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (unitFieldVisible && form.businessUnitIds.length === 0) {
      setError(t('unitsRequired'))
      return
    }
    start(async () => {
      const isCreate = mode === 'create'
      const url = isCreate ? '/api/admin/users' : `/api/admin/users/${user!.id}`
      const method = isCreate ? 'POST' : 'PATCH'
      const businessUnitIds = isAdminRole ? [] : form.businessUnitIds
      const body = isCreate
        ? {
            name: form.name,
            email: form.email,
            username: form.username,
            phone: form.phone || undefined,
            password: form.password,
            role: form.role,
            businessUnitIds,
          }
        : {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            role: form.role,
            businessUnitIds,
          }
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          code?: string
        } | null
        if (data?.code === 'username_taken') setError(t('usernameTaken'))
        else if (data?.code === 'email_taken') setError(t('emailTaken'))
        else if (data?.code === 'role_forbidden') setError(t('roleForbidden'))
        else if (data?.code === 'unit_required') setError(t('unitRequired'))
        else setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      router.push('/admin/users')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            {t('name')}
          </label>
          <input
            id="name"
            className="input"
            required
            minLength={2}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="username">
            {t('username')}
          </label>
          <input
            id="username"
            className="input"
            required={mode === 'create'}
            disabled={mode === 'edit'}
            minLength={3}
            maxLength={USERNAME_MAX_LENGTH}
            aria-invalid={usernameHint ? true : undefined}
            aria-describedby={usernameHint ? 'user-username-error' : undefined}
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
          />
          {usernameHint ? (
            <p
              id="user-username-error"
              className="mt-1 text-xs text-accent-700 dark:text-accent-300"
            >
              {usernameHint}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            className="input"
            required
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            {t('phone')}
          </label>
          <input
            id="phone"
            className="input"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>
      </div>

      {mode === 'create' ? (
        <div>
          <label className="label" htmlFor="password">
            {t('password')}
          </label>
          <PasswordInput
            id="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
          <PasswordStrengthMeter password={form.password} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role">
            {t('role')}
          </label>
          <Select
            id="role"
            value={form.role}
            onChange={(v) => update('role', v as Role)}
            ariaLabel={t('role')}
            options={manageableRoles.map((r) => ({
              value: r,
              label: t(ROLE_LABEL_KEY[r]),
            }))}
          />
        </div>
        {unitFieldVisible ? (
          <fieldset>
            <legend className="label">{t('businessUnits')}</legend>
            <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border bg-surface-2 p-3">
              {selectableUnits.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-fg"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={form.businessUnitIds.includes(u.id)}
                    onChange={() => toggleUnit(u.id)}
                  />
                  <span className="truncate">{u.name}</span>
                </label>
              ))}
              {selectableUnits.length === 0 ? (
                <p className="text-xs text-fg-subtle">—</p>
              ) : null}
            </div>
            {scopedBusinessUnitIds !== null ? (
              <p className="mt-1 text-xs text-fg-subtle">
                {t('businessUnitLocked')}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <div className="flex items-end">
            <p className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
              {t('businessUnitAdminNote')}
            </p>
          </div>
        )}
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
