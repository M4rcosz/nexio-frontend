import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { refreshBackend } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import type { LoginResponse } from '@/lib/api/types'
import { isTokenExpired } from '@/lib/auth/session'
import {
  clearedSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/auth/cookie'

const intlMiddleware = createIntlMiddleware(routing)

const PROTECTED_PATTERNS: RegExp[] = [
  /^\/(?:cart|checkout|loyalty)(?:\/|$)/,
  /^\/(?:payment|orders|profile)(?:\/|$)/,
  /^\/(?:ai)(?:\/|$)/,
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

/**
 * Best-effort coalescing of concurrent refreshes inside a single edge isolate.
 * Prefetch + real navigation can fire nearly together; sharing one in-flight
 * refresh keeps them from double-rotating the token (which would 401 the loser
 * and log the user out). NOTE: the edge runs many isolates, so this is only a
 * mitigation — the prefetch skip below is the primary defense. Keyed by the
 * refresh-token value (unique/rotated per user); the entry is dropped on settle.
 */
const inflightRefresh = new Map<string, Promise<LoginResponse>>()

function dedupedRefresh(refreshToken: string): Promise<LoginResponse> {
  const existing = inflightRefresh.get(refreshToken)
  if (existing) return existing
  const tracked = refreshBackend(refreshToken).finally(() => {
    inflightRefresh.delete(refreshToken)
  })
  inflightRefresh.set(refreshToken, tracked)
  return tracked
}

/**
 * Prefetch/speculative requests (App Router `<Link>` prefetch, browser
 * speculation rules) must never rotate or clear the session — doing so races
 * the user's real navigation and can log them out.
 */
function isPrefetchRequest(req: NextRequest): boolean {
  return (
    req.headers.get('next-router-prefetch') !== null ||
    req.headers.get('purpose') === 'prefetch' ||
    (req.headers.get('sec-purpose')?.includes('prefetch') ?? false)
  )
}

/** A hard auth failure (expired/revoked/reused token) invalidates the session. */
function isAuthFailure(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403)
}

/** Writes a freshly refreshed token pair onto the outgoing response. */
export function applyRefreshedCookies(
  res: NextResponse,
  pair: LoginResponse,
): void {
  res.cookies.set(
    SESSION_COOKIE_NAME,
    pair.access_token,
    sessionCookieOptions(),
  )
  res.cookies.set(
    REFRESH_COOKIE_NAME,
    pair.refresh_token,
    refreshCookieOptions(),
  )
}

/** Expires both auth cookies on the outgoing response. */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
  res.cookies.set(REFRESH_COOKIE_NAME, '', clearedSessionCookieOptions())
}

/**
 * Reflects a rotated token pair onto the incoming request so this navigation's
 * guard and RSC render already see the fresh token. `req.cookies.set` also
 * rewrites the raw `cookie` header, which is what next-intl forwards to the
 * render via `new Headers(req.headers)` — so the render never sees the stale token.
 */
function setRequestSession(req: NextRequest, pair: LoginResponse): void {
  req.cookies.set(SESSION_COOKIE_NAME, pair.access_token)
  req.cookies.set(REFRESH_COOKIE_NAME, pair.refresh_token)
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const localeStripped = stripLocale(pathname)
  const isProtected = PROTECTED_PATTERNS.some((p) => p.test(localeStripped))

  let refreshed: LoginResponse | null = null
  let sessionCleared = false

  // Proactively renew only on protected routes (skip the RTT on public nav) and
  // never on prefetch (rotating there races the real navigation — C2).
  if (isProtected && !isPrefetchRequest(req)) {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value
    if (isTokenExpired(sessionToken) && refreshToken) {
      try {
        refreshed = await dedupedRefresh(refreshToken)
        setRequestSession(req, refreshed)
      } catch (err) {
        // Only a hard auth failure invalidates the session. Transient errors
        // (network/timeout/5xx) leave the cookies intact — the token may still
        // be within its skew window — mirroring refresh/route.ts.
        if (isAuthFailure(err)) {
          sessionCleared = true
          req.cookies.delete(SESSION_COOKIE_NAME)
          req.cookies.delete(REFRESH_COOKIE_NAME)
        }
      }
    }
  }

  if (isProtected) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      const url = req.nextUrl.clone()
      // Preserve the locale prefix on the redirect target.
      const localeMatch = pathname.match(
        new RegExp(
          `^/(${routing.locales.filter((l) => l !== routing.defaultLocale).join('|')})(?=/|$)`,
        ),
      )
      const localePrefix = localeMatch ? localeMatch[0] : ''
      url.pathname = `${localePrefix}/login`
      // Store the locale-stripped path. The login page feeds this to
      // next-intl's localized router, which re-adds the locale prefix — passing
      // the already-prefixed pathname would double it (e.g. /pt-BR/pt-BR/cart)
      // and land the user on a 404 after a successful sign-in.
      url.searchParams.set('redirect', localeStripped)
      const redirect = NextResponse.redirect(url)
      if (sessionCleared) clearAuthCookies(redirect)
      return redirect
    }
  }

  const res = intlMiddleware(req)
  if (refreshed) applyRefreshedCookies(res, refreshed)
  else if (sessionCleared) clearAuthCookies(res)
  return res
}

export const config = {
  // Run on everything except api routes, _next assets and files with extensions.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
