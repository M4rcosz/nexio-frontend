// Single source of truth for the field constraints shared between the browser
// forms and the BFF route handlers. Keeping the numbers/patterns here means the
// client-side instant feedback and the server-side zod schemas can never drift.

/**
 * Allowed username shape: lowercase letters/digits, with `.`, `_` or `-` only in
 * the interior (never at the first or last position). Uppercase is intentionally
 * excluded so it FAILS validation instead of being silently lowercased.
 */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 50
/** Login accepts anything the account may have (lenient) up to this bound. */
export const USERNAME_LOGIN_MAX_LENGTH = 256

/**
 * Reserved handles that must never be claimed at registration/admin-create.
 * Exact (lowercase) match — the username pattern already forces lowercase.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'anonymous',
  'api',
  'auth',
  'login',
  'logout',
  'manager',
  'me',
  'moderator',
  'null',
  'register',
  'root',
  'security',
  'staff',
  'support',
  'system',
  'undefined',
  'user',
  'users',
])

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128
/** Login only checks length (no complexity) so legacy passwords still work. */
export const PASSWORD_LOGIN_MIN_LENGTH = 8

/** Postgres int4 upper bound — the backend stores quantities as int. */
export const MAX_INVENTORY_QUANTITY = 2147483647
export const REASON_MAX_LENGTH = 150

export const EMAIL_MAX_LENGTH = 254
export const NAME_MAX_LENGTH = 120
export const PHONE_MAX_LENGTH = 20
