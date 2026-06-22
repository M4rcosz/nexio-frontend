import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getSession } from '@/lib/auth/session'
import type { Theme } from '@/lib/theme'
import { getTenant } from '@/lib/tenant/resolve'
import { localized } from '@/lib/tenant/config'
import { CartBadge } from './CartBadge'
import { LogoutButton } from './LogoutButton'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'

export async function Header({ initialTheme }: { initialTheme: Theme }) {
  const session = await getSession()
  const isLogged = session !== null
  const showAdminLink =
    session?.role === 'ADMIN' || session?.role === 'MANAGER'
  const t = await getTranslations('header')
  const tAdmin = await getTranslations('admin')
  const locale = await getLocale()
  const tenant = await getTenant()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90 sm:gap-3"
        >
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-9 w-9 flex-none rounded-xl object-cover sm:h-10 sm:w-10"
            />
          ) : (
            <span className="relative inline-flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-glow sm:h-10 sm:w-10">
              <span className="relative z-10 font-display text-base font-extrabold sm:text-lg">
                {tenant.logoMark}
              </span>
              <span className="absolute inset-0 bg-hero-grain opacity-30 mix-blend-overlay" />
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-fg sm:text-lg">
              {tenant.name}
            </span>
            <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.18em] text-fg-subtle sm:inline">
              {localized(tenant.tagline, locale)}
            </span>
          </span>
        </Link>

        <nav className="flex flex-none items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/"
            className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
          >
            {t('units')}
          </Link>
          {isLogged ? (
            <>
              <Link
                href="/orders"
                className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
              >
                {t('myOrders')}
              </Link>
              <Link
                href="/loyalty"
                className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
              >
                {t('points')}
              </Link>
              {showAdminLink ? (
                <Link
                  href="/admin"
                  aria-label={tAdmin('headerLink')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-500/20 dark:text-brand-300 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <ShieldIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {tAdmin('headerLink')}
                  </span>
                </Link>
              ) : null}
              <CartBadge />
              <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
              <span className="hidden text-xs text-fg-muted xl:inline">
                {t('greeting', { name: session?.username ?? '' })}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <CartBadge />
              <Link
                href="/login"
                className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/register"
                className="btn-primary !px-3 !py-2 text-xs sm:!px-4 sm:text-sm"
              >
                {t('signUp')}
              </Link>
            </>
          )}
          <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
          <LanguageSwitcher />
          <ThemeToggle initial={initialTheme} />
        </nav>
      </div>
    </header>
  )
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
