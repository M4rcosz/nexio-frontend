import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Inter, Space_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { PATHNAME_HEADER } from '@/lib/i18n/pathname'
import { shellTier } from '@/lib/layout/shell'
import { Header } from '@/components/Header'
import { PrefetchRoutes } from '@/components/PrefetchRoutes'
import { RouteTransition } from '@/components/RouteTransition'
import { Shell } from '@/components/layout/Shell'
import { TenantProvider } from '@/components/TenantProvider'
import { getSession } from '@/lib/auth/session'
import { getTheme } from '@/lib/theme'
import { getTenant } from '@/lib/tenant/resolve'
import { localized, tenantThemeVars, toBranding } from '@/lib/tenant/config'
import '../globals.css'

// DEV-ONLY quick account switcher. The ternary collapses to `() => null` in a
// production build, so the bundler dead-code-eliminates the import() and the
// component never ships. (Vercel preview builds run with NODE_ENV=production
// too, so it won't appear there either — switch to VERCEL_ENV if you want it.)
const DevAccountSwitcher: React.ComponentType<{
  currentUsername?: string | null
}> =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() =>
        import('@/components/dev/DevAccountSwitcher').then(
          (m) => m.DevAccountSwitcher,
        ),
      )

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
})

// Geometric display face for titles and the Nexio wordmark.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const tenant = await getTenant()
  return {
    title: tenant.name,
    description: localized(tenant.description, locale),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // Width tier for this route. The middleware stamps the pathname on the
  // request (server components cannot read the URL); an absent header resolves
  // to the conservative default tier. This layout is already request-dynamic
  // (cookies + headers), so the read costs nothing extra.
  const tier = shellTier((await headers()).get(PATHNAME_HEADER) ?? '')

  const t = await getTranslations({ locale, namespace: 'footer' })
  const theme = await getTheme()
  const tenant = await getTenant()
  const themeVars = tenantThemeVars(tenant) as React.CSSProperties

  // Only resolved in dev — the switcher and this cookie read are gone in prod.
  const devUsername =
    process.env.NODE_ENV !== 'production'
      ? ((await getSession())?.username ?? null)
      : null

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} ${theme === 'dark' ? 'dark' : ''}`}
      style={themeVars}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <NextIntlClientProvider>
          <TenantProvider branding={toBranding(tenant)}>
            <PrefetchRoutes />
            <div className="relative flex min-h-screen flex-col">
              <Header initialTheme={theme} />
              <Shell as="main" tier={tier} className="flex-1 py-5 sm:py-8">
                <RouteTransition>{children}</RouteTransition>
              </Shell>
              <Shell
                as="footer"
                tier={tier}
                className="pb-8 pt-12 text-xs text-fg-subtle sm:pb-10 sm:pt-16"
              >
                <div className="flex flex-col items-start justify-between gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:pt-6">
                  <p>
                    {t('tagline', {
                      year: new Date().getFullYear(),
                      name: tenant.name,
                    })}
                  </p>
                </div>
              </Shell>
            </div>
            <DevAccountSwitcher currentUsername={devUsername} />
          </TenantProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
