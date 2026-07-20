import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'

/** Roles allowed to ring up in-person orders. KITCHEN is excluded — it does not
 * serve customers (doc §2). */
const POS_ROLES = new Set(['ADMIN', 'MANAGER', 'ATTENDANT'])

export default async function PosLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSession()
  const t = await getTranslations('pos')

  if (!session || !POS_ROLES.has(session.role)) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-border bg-accent-500/10 p-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent-700 dark:text-accent-300">
              403
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg">
              {t('forbiddenTitle')}
            </h1>
          </div>
          <p className="p-6 text-sm text-fg-muted">{t('forbiddenBody')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
          {t('kicker')}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>
      {children}
    </div>
  )
}
