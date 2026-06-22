import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link, redirect } from '@/i18n/navigation'
import { isAuthenticated } from '@/lib/auth/session'
import { RegisterForm } from '@/components/RegisterForm'
import { StubBadge } from '@/components/StubBadge'

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  if (await isAuthenticated()) redirect({ href: '/', locale })
  const t = await getTranslations('register')

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="card relative overflow-hidden p-7">
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent-500/20 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              {t('title')}
            </h1>
            <StubBadge />
          </div>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
          <RegisterForm />
          <p className="mt-5 text-sm text-fg-muted">
            {t('haveAccount')}{' '}
            <Link
              href="/login"
              className="font-semibold text-brand-500 hover:text-brand-600"
            >
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
