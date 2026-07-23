import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PATHNAME_HEADER, stripLocale } from '@/lib/i18n/pathname'
import { shellTier } from '@/lib/layout/shell'
import { Shell } from '@/components/layout/Shell'
import { getSession } from '@/lib/auth/session'
import { getMyAiMembership } from '@/lib/api/ai'
import type { Theme } from '@/lib/theme'
import { getTenant } from '@/lib/tenant/resolve'
import { CartBadge } from '@/components/cart/CartBadge'
import { SessionWatcher } from '@/components/auth/SessionWatcher'
import { UserMenu } from './UserMenu'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'

export async function Header({ initialTheme }: { initialTheme: Theme }) {
  const session = await getSession()
  const isLogged = session !== null
  const showAdminLink = session?.role === 'ADMIN' || session?.role === 'MANAGER'
  // Orders, loyalty points and the cart are customer-facing — staff get none.
  const isCustomer = session?.role === 'CUSTOMER'
  // The cart stays available to logged-out guests too (guest checkout).
  const showCart = !isLogged || isCustomer
  // Assistant nav: customers never see it, and staff only see it once they
  // actually hold an AI membership (no dead link to a locked-out page).
  const membership = isLogged && !isCustomer ? await getMyAiMembership() : null
  const showAssistantLink = isLogged && !isCustomer && membership !== null
  // On the attended kiosk (/totem) the device holds a staff session, but it is
  // physically operated by walk-up customers. Suppress the account menu and all
  // nav so a customer can't log the device out or reach staff/admin areas
  // mid-order. Interim mitigation until /totem gets its own chrome-less layout.
  // The same pathname also picks the nav's width tier so the header lines up
  // with the page shell — clamped, so /login never squeezes it to the prose cap.
  const pathname = stripLocale((await headers()).get(PATHNAME_HEADER) ?? '')
  const isKiosk = pathname === '/totem' || pathname.startsWith('/totem/')
  const t = await getTranslations('header')
  const tAdmin = await getTranslations('admin')
  const tenant = await getTenant()
  // Wordmark: first letter gets the fancy gradient treatment, rest stays plain.
  const brandInitial = tenant.name.slice(0, 1)
  const brandRest = tenant.name.slice(1)

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/70 backdrop-blur-xl">
      <Shell
        tier={shellTier(pathname)}
        clamp
        className="flex items-center justify-between gap-2 py-2.5 sm:gap-3 sm:py-3"
      >
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-1.5 transition-opacity hover:opacity-90 sm:gap-2"
        >
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-9 w-9 flex-none rounded-xl object-cover sm:h-10 sm:w-10"
            />
          ) : (
            <BoltIcon className="h-5 w-5 flex-none rotate-[18deg] drop-shadow-[0_0_10px_rgb(var(--brand-500)/0.8)] sm:h-6 sm:w-6" />
          )}
          <span className="font-display flex items-baseline truncate text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
            <span className="text-gradient-brand mr-[0.02em] inline-block -skew-x-[16deg] text-[1.3em] font-black">
              {brandInitial}
            </span>
            <span className="inline-block -skew-x-[6deg]">{brandRest}</span>
          </span>
        </Link>

        <nav className="flex flex-none items-center gap-1 text-sm sm:gap-2">
          {isKiosk ? null : isLogged ? (
            <>
              {isCustomer ? (
                <Link
                  href="/orders"
                  className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
                >
                  {t('myOrders')}
                </Link>
              ) : null}
              {showAssistantLink ? (
                <Link
                  href="/ai"
                  className="hidden rounded-xl px-3 py-2 font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
                >
                  {t('assistant')}
                </Link>
              ) : null}
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
              <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
              <UserMenu
                username={session?.username ?? ''}
                showPoints={isCustomer}
              />
              <SessionWatcher />
            </>
          ) : (
            <>
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
          {isKiosk ? null : (
            <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
          )}
          <LanguageSwitcher />
          <ThemeToggle initial={initialTheme} />
          {showCart ? <CartBadge /> : null}
        </nav>
      </Shell>
    </header>
  )
}

function BoltIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        {/* Same brand ramp as the .text-gradient-brand "N": brand → accent. */}
        <linearGradient id="bolt-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--brand-500))' }} />
          <stop offset="45%" style={{ stopColor: 'rgb(var(--brand-600))' }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-600))' }} />
        </linearGradient>
      </defs>
      <path
        fill="url(#bolt-gradient)"
        d="M13.5 1 L3.5 14.2 L10 13.6 L8 23 L20.5 8.2 L13.2 8.9 Z"
      />
    </svg>
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
