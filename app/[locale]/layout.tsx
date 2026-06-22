import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Header } from '@/components/Header'
import { PrefetchRoutes } from '@/components/PrefetchRoutes'
import { RouteTransition } from '@/components/RouteTransition'
import { TenantProvider } from '@/components/TenantProvider'
import { getTheme } from '@/lib/theme'
import { getTenant } from '@/lib/tenant/resolve'
import { localized, tenantThemeVars, toBranding } from '@/lib/tenant/config'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
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

  const t = await getTranslations({ locale, namespace: 'footer' })
  const theme = await getTheme()
  const tenant = await getTenant()
  const themeVars = tenantThemeVars(tenant) as React.CSSProperties

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${theme === 'dark' ? 'dark' : ''}`}
      style={themeVars}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <NextIntlClientProvider>
          <TenantProvider branding={toBranding(tenant)}>
            <PrefetchRoutes />
            <div className="relative flex min-h-screen flex-col">
              <Header initialTheme={theme} />
              <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
                <RouteTransition>{children}</RouteTransition>
              </main>
              <footer className="mx-auto w-full max-w-6xl px-3 pb-8 pt-12 text-xs text-fg-subtle sm:px-6 sm:pb-10 sm:pt-16 lg:px-8">
                <div className="flex flex-col items-start justify-between gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:pt-6">
                  <p>{t('tagline', { year: new Date().getFullYear(), name: tenant.name })}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                    v0.1 · made with ☼
                  </p>
                </div>
              </footer>
            </div>
          </TenantProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
