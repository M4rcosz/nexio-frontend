'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
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
  scopedBusinessUnitId,
  manageableRoles,
}: {
  mode: Mode
  user?: User
  units: PublicBusinessUnit[]
  /** When set, the form locks the business unit field (MANAGER scope). */
  scopedBusinessUnitId: string | null
  manageableRoles: Role[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.form')
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
    // The form still picks a single unit; the API models a set, so the first
    // bound unit seeds the field.
    businessUnitId:
      user?.businessUnitIds[0] ?? scopedBusinessUnitId ?? units[0]?.id ?? '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  const isAdminRole = form.role === 'ADMIN'
  // ADMIN role has no unit; for everyone else it's required.
  const unitFieldVisible = !isAdminRole
  const unitLocked = scopedBusinessUnitId !== null && !isAdminRole

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (unitFieldVisible && !(scopedBusinessUnitId ?? form.businessUnitId)) {
      setError(t('unitRequired'))
      return
    }
    start(async () => {
      const isCreate = mode === 'create'
      const url = isCreate ? '/api/admin/users' : `/api/admin/users/${user!.id}`
      const method = isCreate ? 'POST' : 'PATCH'
      const businessUnitId = isAdminRole
        ? null
        : (scopedBusinessUnitId ?? form.businessUnitId)
      const body = isCreate
        ? {
            name: form.name,
            email: form.email,
            username: form.username,
            phone: form.phone || undefined,
            password: form.password,
            role: form.role,
            businessUnitId,
          }
        : {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            role: form.role,
            businessUnitId,
          }
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null
        if (data?.code === 'username_taken') setError(t('usernameTaken'))
        else if (data?.code === 'email_taken') setError(t('emailTaken'))
        else if (data?.code === 'role_forbidden') setError(t('roleForbidden'))
        else if (data?.code === 'unit_required') setError(t('unitRequired'))
        else setError(data?.error ?? t('failed'))
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
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
          />
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
          <input
            id="password"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role">
            {t('role')}
          </label>
          <select
            id="role"
            className="input"
            value={form.role}
            onChange={(e) => update('role', e.target.value as Role)}
          >
            {manageableRoles.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL_KEY[r])}
              </option>
            ))}
          </select>
        </div>
        {unitFieldVisible ? (
          <div>
            <label className="label" htmlFor="unit">
              {t('businessUnit')}
            </label>
            <select
              id="unit"
              className="input"
              disabled={unitLocked}
              value={scopedBusinessUnitId ?? form.businessUnitId}
              onChange={(e) => update('businessUnitId', e.target.value)}
            >
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {unitLocked ? (
              <p className="mt-1 text-xs text-fg-subtle">
                {t('businessUnitLocked')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-end">
            <p className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
              {t('businessUnitAdminNote')}
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
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
