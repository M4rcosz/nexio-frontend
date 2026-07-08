import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAdminContext } from '@/lib/auth/access'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) {
    const t = await getTranslations('admin.errors')
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
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_1fr]">
      <AdminSidebar role={ctx.role} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
