'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import type { BusinessUnit, Role, User } from '@/lib/api/types'
import { UserStatusBadge } from './UserStatusBadge'

const ROLE_LABEL_KEY: Record<Role, string> = {
  ATTENDANT: 'roleAttendant',
  KITCHEN: 'roleKitchen',
  MANAGER: 'roleManager',
  ADMIN: 'roleAdmin',
  CUSTOMER: 'roleAttendant',
}

/** Mobile-friendly variant of UserRow — used below `md` screens. */
export function UserCard({
  user,
  unit,
}: {
  user: User
  unit: BusinessUnit | null
}) {
  const router = useRouter()
  const t = useTranslations('admin.users')
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
        setOptimisticActive(!next)
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? t('actionFailed'))
        return
      }
      router.refresh()
    })
  }

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-fg-subtle">
            {user.username} · {user.email}
          </p>
        </div>
        <UserStatusBadge active={optimisticActive} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableRole')}
          </dt>
          <dd className="mt-0.5 text-fg">
            {tForm(ROLE_LABEL_KEY[user.role])}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableUnit')}
          </dt>
          <dd className="mt-0.5 truncate text-fg">
            {unit?.name ?? user.businessUnitId ?? '—'}
          </dd>
        </div>
      </dl>
      {error ? (
        <p className="mt-3 text-xs text-accent-600">{error}</p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/admin/users/${user.id}`}
          className="btn-secondary flex-1 !py-2 text-xs"
        >
          {t('actionEdit')}
        </Link>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            optimisticActive
              ? 'border border-accent-500/30 bg-accent-500/10 text-accent-700 hover:bg-accent-500/20 dark:text-accent-300'
              : 'border border-forest-500/30 bg-forest-500/10 text-forest-700 hover:bg-forest-500/20 dark:text-forest-400'
          }`}
        >
          {optimisticActive ? t('actionDisable') : t('actionEnable')}
        </button>
      </div>
    </article>
  )
}
