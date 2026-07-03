import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link, redirect } from '@/i18n/navigation'
import { isAuthenticated } from '@/lib/auth/session'
import { LoginForm } from '@/components/LoginForm'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ redirect?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  if (await isAuthenticated()) {
    redirect({ href: sp.redirect ?? '/', locale })
  }
  const t = await getTranslations('login')

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card relative overflow-hidden p-7">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-gradient opacity-20 blur-3xl" aria-hidden />
        <div className="relative">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
          <LoginForm redirectTo={sp.redirect ?? '/'} />
          <p className="mt-5 text-sm text-fg-muted">
            {t('noAccount')}{' '}
            <Link
              href="/register"
              className="font-semibold text-brand-500 hover:text-brand-600"
            >
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
