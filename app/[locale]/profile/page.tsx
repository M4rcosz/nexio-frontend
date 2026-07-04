import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getMe, isAccountGoneError } from '@/lib/api/users'
import { listBusinessUnits } from '@/lib/api/business-units'
import { ApiError } from '@/lib/api/errors'
import { AccountGoneRedirect } from '@/components/AccountGoneRedirect'
import type { User } from '@/lib/api/types'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('profile')

  let user: User
  try {
    user = await getMe()
  } catch (err) {
    // Only an explicit account-removed signal signs the user out — a generic
    // 404 (missing route/gateway) falls through to the error boundary instead.
    if (isAccountGoneError(err)) return <AccountGoneRedirect />
    if (err instanceof ApiError) {
      // 401 → session no longer valid: back to login.
      if (err.status === 401) redirect(`/${locale}/login`)
    }
    throw err
  }

  // Resolve unit names for staff users (customers are unbound → []).
  let unitNames: string[] = []
  if (user.businessUnitIds.length > 0) {
    const { data } = await listBusinessUnits()
    const byId = new Map(data.map((u) => [u.id, u.name]))
    unitNames = user.businessUnitIds.map((id) => byId.get(id) ?? id)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm font-medium text-fg-muted hover:text-brand-500"
        >
          ← {t('back')}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </div>

      <div className="card overflow-hidden p-0">
        <dl className="divide-y divide-border">
          <Field label={t('username')} value={user.username} mono />
          <Field label={t('name')} value={user.name} />
          <Field label={t('email')} value={user.email ?? t('notProvided')} />
          <Field label={t('phone')} value={user.phone ?? t('notProvided')} />
          <Field label={t('role')} value={user.role} />
          <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
              {t('units')}
            </dt>
            <dd className="text-sm text-fg">
              {unitNames.length > 0 ? unitNames.join(', ') : t('noUnits')}
            </dd>
          </div>
          <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
              {t('status')}
            </dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  user.isActive
                    ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
                    : 'bg-surface-2 text-fg-subtle'
                }`}
              >
                {user.isActive ? t('active') : t('inactive')}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-xs font-mono uppercase tracking-widest text-fg-subtle">
        {label}
      </dt>
      <dd className={`text-sm text-fg ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
