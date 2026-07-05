/**
 * Sanitizes a post-login redirect target. Only same-origin, locale-agnostic
 * absolute paths are allowed, so a crafted `?redirect=` cannot bounce the user
 * to an external site (open redirect) or inject a protocol.
 *
 * The value is expected WITHOUT a locale prefix (the middleware strips it), so
 * next-intl's localized router can add the correct one exactly once.
 */
export function safeRedirect(target?: string | null): string {
  if (!target) return '/'
  // Must be an internal absolute path.
  if (!target.startsWith('/')) return '/'
  // Reject protocol-relative "//host" and backslash tricks: browsers normalize
  // "\" to "/" when resolving a Location header, so "/\evil.com" would escape to
  // "//evil.com" (external). Also reject control chars anywhere in the value.
  if (target.startsWith('//')) return '/'
  if (/[\\\x00-\x1f]/.test(target)) return '/'
  return target
}
