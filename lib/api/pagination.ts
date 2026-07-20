/** Shared cursor-pagination helpers for the admin route handlers. */

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

/**
 * Coerces a `?limit=` string into the contract's 1..100 integer range,
 * truncating fractional values and falling back to the default for anything
 * missing or non-numeric. Mirrors the server-side cap so an out-of-range
 * value never reaches the backend as a 400.
 */
export function parseLimit(
  raw: string | null,
  fallback = DEFAULT_LIMIT,
): number {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT)
}
