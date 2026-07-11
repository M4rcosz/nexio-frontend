import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * Hostnames allowed through the next/image optimizer. Comma-separated globs in
 * NEXT_PUBLIC_IMAGE_HOSTNAMES (e.g. "cdn.acme.com,*.imgix.net"). When unset it
 * falls back to `**` (any HTTPS host) for local/mock development — but that turns
 * the optimizer into an open image proxy, so production deployments MUST set the
 * env var to their real CDN host(s).
 */
const imageHostnames = (process.env.NEXT_PUBLIC_IMAGE_HOSTNAMES ?? '**')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

/**
 * Baseline security headers applied to every response. Intentionally omits a
 * full Content-Security-Policy for scripts/styles — that needs per-app tuning
 * (sources, nonces) and is tracked separately; only frame-ancestors is set here.
 */
const securityHeaders = [
  // Disallow framing entirely — this app is never meant to be embedded.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
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
      { protocol: 'http' as const, hostname: 'localhost' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
