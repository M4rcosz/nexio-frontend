import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const isProd = process.env.NODE_ENV === 'production'

/**
 * Hostnames allowed through the next/image optimizer. Comma-separated globs in
 * NEXT_PUBLIC_IMAGE_HOSTNAMES (e.g. "cdn.acme.com,*.imgix.net"). Resolved here at
 * config-load (build) time. In development it falls back to `**` (any HTTPS host)
 * for convenience; in production it fails CLOSED — an unset var yields an empty
 * allowlist (all remote images blocked) rather than an open image proxy. The env
 * validation (lib/env.ts) also hard-fails at boot when it's unset in prod, so a
 * misconfigured deploy is caught at both build and start.
 */
const imageHostnames = (
  process.env.NEXT_PUBLIC_IMAGE_HOSTNAMES ?? (isProd ? '' : '**')
)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

/**
 * `img-src` sources, derived from the same allowlist as the optimizer above.
 *
 * Product images render through a plain `<img>` (see `ProductImage`), which the
 * `remotePatterns` allowlist does not cover — so without this a stored
 * `imageUrl` pointing at a third party would fire a request from every visitor
 * of a public menu page, beaconing their IP and UA. `ProductImage` already
 * refuses such URLs at render; this is the browser-level backstop for anything
 * that slips past it (or any other `<img>` added later).
 *
 * `data:`/`blob:` are permitted for locally-produced previews. `**` (the dev
 * fallback) widens to any http(s) host so local fixtures keep working.
 */
const imgSrc = [
  "'self'",
  'data:',
  'blob:',
  ...(imageHostnames.includes('**')
    ? ['https:', 'http:']
    : imageHostnames.map((h) => `https://${h}`)),
].join(' ')

/**
 * Baseline security headers applied to every response. Intentionally omits a
 * full Content-Security-Policy for scripts/styles — that needs per-app tuning
 * (sources, nonces) and is tracked separately; only frame-ancestors and img-src
 * are set here.
 */
const securityHeaders = [
  // Force HTTPS for two years incl. subdomains. Harmless over plain HTTP
  // (browsers ignore it there); prevents protocol-downgrade/cookie-stripping.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  // Disallow framing entirely — this app is never meant to be embedded.
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: `frame-ancestors 'none'; img-src ${imgSrc}`,
  },
  // Stop browsers from MIME-sniffing responses away from their declared type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs (which may carry ids) to third-party origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Opt out of powerful features the app doesn't use.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      ...imageHostnames.map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })),
      // Loopback is a dev convenience only — allowing it in production would let
      // /_next/image proxy internal services bound to localhost (SSRF).
      ...(isProd ? [] : [{ protocol: 'http' as const, hostname: 'localhost' }]),
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
