/**
 * Opaque keyset cursors for the mock listings.
 *
 * The real backend pages with a keyset predicate and hands back a base64url
 * token that encodes the row's sort key, not its id. Mocks that accepted a
 * bare row id let broken cursor-construction code pass in dev and fail only
 * against the live API — so they mint and demand the same opaque shape here.
 *
 * Two behaviours matter for parity, both deliberate:
 *  - a token that cannot be decoded is a 422, never a silent restart;
 *  - a token naming a row that no longer matches the filter is also a 422,
 *    never a silently short page. That short page was the original bug.
 */
import { ApiError } from '@/lib/api/errors'

export function encodeMockCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf-8').toString('base64url')
}

export function decodeMockCursor(raw: string): string | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'))
    return parsed && typeof parsed.id === 'string' ? parsed.id : null
  } catch {
    return null
  }
}

/**
 * Resolves a cursor to the index the next page starts at, throwing the live
 * endpoint's 422 for anything stale or malformed. Returns 0 when there is no
 * cursor at all.
 */
export function cursorStart<T extends { id: string }>(
  rows: T[],
  cursor?: string,
): number {
  if (!cursor) return 0
  const id = decodeMockCursor(cursor)
  if (id === null) {
    throw new ApiError(422, null, 'Invalid pagination cursor.')
  }
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) {
    throw new ApiError(422, null, 'Invalid pagination cursor.')
  }
  return idx + 1
}
