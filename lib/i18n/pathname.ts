import { routing } from '@/i18n/routing'

/**
 * Request header the middleware stamps with the incoming pathname so server
 * components — which otherwise cannot read the current URL — can branch on the
 * route (e.g. suppressing the account menu on the attended kiosk). next-intl
 * forwards the request headers to the render, so a header set on the incoming
 * request reaches the RSC via `next/headers`.
 */
export const PATHNAME_HEADER = 'x-nexio-pathname'

/**
 * Strips a leading locale segment ("/pt-BR/totem" → "/totem", "/pt-BR" → "/").
 * Shared by the middleware and any server component that needs the
 * locale-agnostic path.
 */
export function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`
    if (pathname === prefix) return '/'
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  }
  return pathname
}
