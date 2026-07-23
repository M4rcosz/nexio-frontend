import { stripLocale } from '@/lib/i18n/pathname'

/**
 * Width tiers for the app shell.
 *
 * A single global cap forces every surface into the same box: data tables get
 * squeezed while forms and prose have nothing to gain from the extra pixels.
 * The tiers cap per *content type* instead — line-length-bound content never
 * widens, card grids gain columns, tables get room, kiosk goes edge to edge.
 *
 * - `prose`   — reading/typing surfaces (auth, profile): ~65-75ch, never wider.
 * - `content` — the safe default for mixed pages (today's 1152px).
 * - `wide`    — dense/tabular and grid surfaces (admin, assistant, catalogs).
 * - `full`    — chrome-less, self-centering surfaces (kiosk).
 */
export type ShellTier = 'prose' | 'content' | 'wide' | 'full'

/** Reading/typing surfaces. Matched as prefixes so nested routes inherit. */
const PROSE_PREFIXES = ['/login', '/register', '/profile'] as const

/** Dense surfaces that benefit from horizontal room. */
const WIDE_PREFIXES = ['/admin', '/ai'] as const

/** Kiosk — the flow centers itself, so the shell must not cap it. */
const FULL_PREFIXES = ['/totem'] as const

/**
 * A unit's storefront (`/units/<id>`) is a card grid and goes wide; anything
 * deeper (`/units/<id>/products/<productId>`) is a detail page and stays at the
 * default tier.
 */
const UNIT_STOREFRONT = /^\/units\/[^/]+$/

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Normalizes to a comparable path: strips the locale segment and any trailing
 * slash. An empty input stays empty on purpose — it must NOT be read as the
 * home route (server components that cannot resolve the pathname fall back to
 * `''`, and those must land on the safe default tier).
 */
function normalize(pathname: string): string {
  const path = stripLocale(pathname)
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Resolves the width tier for a route. `pathname` is normally already
 * locale-stripped by the caller; passing a locale-prefixed path also works
 * (stripping is idempotent).
 *
 * PRESENTATION ONLY — this never gates access. Role checks live in
 * `getAdminContext` / `POS_ROLES` / `KIOSK_ROLES`.
 */
export function shellTier(pathname: string): ShellTier {
  const path = normalize(pathname)
  if (path === '/') return 'wide'
  if (FULL_PREFIXES.some((p) => isUnder(path, p))) return 'full'
  if (WIDE_PREFIXES.some((p) => isUnder(path, p))) return 'wide'
  if (UNIT_STOREFRONT.test(path)) return 'wide'
  if (PROSE_PREFIXES.some((p) => isUnder(path, p))) return 'prose'
  // Unknown routes — including `''` — get the conservative default. `/pos` is
  // deliberately here: its single-column form would not survive 1600px.
  return 'content'
}

const TIER_CLASS: Record<ShellTier, string> = {
  prose: 'shell shell-prose',
  content: 'shell shell-content',
  wide: 'shell shell-wide',
  full: 'shell shell-full',
}

/** The `.shell*` class pair for a tier (see `app/globals.css`). */
export function shellClass(tier: ShellTier): string {
  return TIER_CLASS[tier]
}

/**
 * The tier the global nav should use for a page tier.
 *
 * The header is chrome, not content: shrinking it to the prose cap on `/login`
 * would leave the wordmark and the account menu huddled in the middle of the
 * viewport. Clamp `prose` up to `content` and pass everything else through.
 */
export function headerTier(tier: ShellTier): ShellTier {
  return tier === 'prose' ? 'content' : tier
}
