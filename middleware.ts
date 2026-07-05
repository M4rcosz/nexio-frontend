import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? 'nexio_session'

const intlMiddleware = createIntlMiddleware(routing)

const PROTECTED_PATTERNS: RegExp[] = [
  /^\/(?:cart|checkout|loyalty)(?:\/|$)/,
  /^\/(?:payment|orders)(?:\/|$)/,
  /^\/admin(?:\/|$)/,
]

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`
    if (pathname === prefix) return '/'
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  }
  return pathname
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const localeStripped = stripLocale(pathname)
  const isProtected = PROTECTED_PATTERNS.some((p) => p.test(localeStripped))

  if (isProtected) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      const url = req.nextUrl.clone()
      // Preserve the locale prefix on the redirect target.
      const localeMatch = pathname.match(
        new RegExp(`^/(${routing.locales.filter((l) => l !== routing.defaultLocale).join('|')})(?=/|$)`),
      )
      const localePrefix = localeMatch ? localeMatch[0] : ''
      url.pathname = `${localePrefix}/login`
      // Store the locale-stripped path. The login page feeds this to
      // next-intl's localized router, which re-adds the locale prefix — passing
      // the already-prefixed pathname would double it (e.g. /pt-BR/pt-BR/cart)
      // and land the user on a 404 after a successful sign-in.
      url.searchParams.set('redirect', localeStripped)
      return NextResponse.redirect(url)
    }
  }

  return intlMiddleware(req)
}

export const config = {
  // Run on everything except api routes, _next assets and files with extensions.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
