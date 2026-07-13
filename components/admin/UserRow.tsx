'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Link, useRouter } from '@/i18n/navigation'
import type { PublicBusinessUnit, Role, User } from '@/lib/api/types'
import { UserStatusBadge } from './UserStatusBadge'

const ROLE_LABEL_KEY: Record<Role, string> = {
  ATTENDANT: 'roleAttendant',
  KITCHEN: 'roleKitchen',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
  CUSTOMER: 'roleAttendant',
}

export function UserRow({
  user,
  unit,
}: {
  user: User
  unit: PublicBusinessUnit | null
}) {
  const router = useRouter()
  const t = useTranslations('admin.users')
  const errorMessage = useErrorMessage()
  const tForm = useTranslations('admin.form')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [optimisticActive, setOptimisticActive] = useState(user.isActive)

  function toggleActive() {
    if (optimisticActive) {
      const ok = window.confirm(t('confirmDisable'))
      if (!ok) return
    }
    setError(null)
    const next = !optimisticActive
    setOptimisticActive(next)
    start(async () => {
      const res = await fetch(`/api/admin/users/${user.id}/active`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        setOptimisticActive(!next) // revert
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('actionFailed'))
        return
      }
      router.refresh()
    })
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <div className="font-medium text-fg">{user.name}</div>
        <div className="text-xs text-fg-subtle">
          {user.username} · {user.email}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-fg-muted">
        {tForm(ROLE_LABEL_KEY[user.role])}
      </td>
      <td className="px-4 py-3 text-sm text-fg-muted">
        {unit?.name ?? user.businessUnitIds[0] ?? '—'}
        {user.businessUnitIds.length > 1
          ? ` +${user.businessUnitIds.length - 1}`
          : ''}
      </td>
      <td className="px-4 py-3">
        <UserStatusBadge active={optimisticActive} />
      </td>
      <td className="px-4 py-3 text-right">
        {error ? (
          <span role="alert" className="mr-3 text-xs text-accent-600">
            {error}
          </span>
        ) : null}
        <div className="inline-flex items-center gap-1.5">
          <Link
            href={`/admin/users/${user.id}`}
            className="btn-ghost !px-2 !py-1 text-xs"
          >
            {t('actionEdit')}
          </Link>
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              optimisticActive
                ? 'text-accent-600 hover:bg-accent-500/10'
                : 'text-forest-600 hover:bg-forest-500/10'
            }`}
          >
            {optimisticActive ? t('actionDisable') : t('actionEnable')}
          </button>
        </div>
      </td>
    </tr>
  )
}
