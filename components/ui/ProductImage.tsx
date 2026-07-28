'use client'

import { useEffect, useState } from 'react'

/**
 * Storage hosts product images may come from — the same allowlist that gates
 * the next/image optimizer (`NEXT_PUBLIC_IMAGE_HOSTNAMES`, resolved in
 * `next.config.ts`). A plain `<img>` bypasses `remotePatterns` entirely, so the
 * check has to be repeated here.
 *
 * Empty means "unconfigured" and stays permissive: in production `lib/env.ts`
 * hard-fails at boot when the var is unset, so an empty list here can only be a
 * local dev box.
 */
const ALLOWED_IMAGE_HOSTS = (process.env.NEXT_PUBLIC_IMAGE_HOSTNAMES ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

/** Mirrors the `hostname` globs next/image accepts: exact, `**`, or `*.domain`. */
function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_IMAGE_HOSTS.length === 0) return true
  return ALLOWED_IMAGE_HOSTS.some(
    (pattern) =>
      pattern === '**' ||
      pattern === hostname ||
      (pattern.startsWith('*.') && hostname.endsWith(pattern.slice(1))),
  )
}

/**
 * Whether a stored `imageUrl` is safe to hand to `<img src>`.
 *
 * Only root-relative paths and absolute http(s) URLs on an allowed storage host
 * qualify. Anything else is treated as "no image" rather than rendered, for two
 * separate reasons:
 *
 *  - the browser resolves a bare relative string against the *current page*, so
 *    seed rows carrying values like `@example4.com` had `/admin/products` firing
 *    real requests at `/admin/@example4.com` on our own origin; and
 *  - `imageUrl` is admin-writable and accepted for any https host by the write
 *    schema, so an arbitrary third-party URL would beacon the IP and UA of every
 *    visitor to a public menu page.
 */
function isRenderableImageUrl(src: string): boolean {
  // Protocol-relative (`//host`) only *looks* root-relative — the browser
  // resolves it against the page scheme and loads it off-origin, skipping the
  // checks below entirely. `/\host` is the same URL to the parser, so both
  // slash shapes are rejected before the root-relative fast path.
  if (/^\/[/\\]/.test(src)) return false
  // Same-origin by construction, so the host allowlist doesn't apply.
  if (src.startsWith('/')) return true
  try {
    const url = new URL(src)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return isAllowedHost(url.hostname)
  } catch {
    return false
  }
}

/**
 * Renders a product image and swaps in the placeholder emoji when the URL is
 * missing, empty, unusable or fails to load (404, broken host, blocked request).
 */
export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName = 'text-6xl opacity-80',
  fallbackEmoji = '🍲',
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  /** Placeholder glyph; callers use a smaller/different one in dense lists. */
  fallbackEmoji?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed || !isRenderableImageUrl(src)) {
    return (
      <span className={fallbackClassName} aria-hidden>
        {fallbackEmoji}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
