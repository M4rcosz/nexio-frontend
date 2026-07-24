// Single source of truth for conversation titles, shared by the mock (which
// derives a title from the first user message, mirroring the real backend) and
// the browser (which validates a rename before it leaves the client).
//
// Everything here counts CODE POINTS via `[...str]`, never `.length`/`.slice`:
// those operate on UTF-16 units, so a title of 80 emoji (each a surrogate pair)
// would read as 160 and get wrongly rejected or split mid-character.
import { CONVERSATION_TITLE_MAX_LENGTH } from '@/lib/validation/constants'

/** Fixed fallback for a pure-whitespace opener. A server-derived DATA value,
 *  intentionally NOT localized — it is stored and returned like any title. */
const NEW_CONVERSATION = 'New conversation'

/** Literal marker appended when a title is truncated. Its own length is
 *  reserved out of the cap so the FULL result stays ≤ the limit. */
const ELLIPSIS = '...'

/** Trim, then collapse every internal run of whitespace (incl. `\n`/`\t`) to a
 *  single space. What a rename stores, mirroring the server's normalization. */
export function normalizeTitle(v: string): string {
  return v.trim().replace(/\s+/g, ' ')
}

/** Code-point length — surrogate-pair safe, unlike `.length`. */
export function titleLength(v: string): number {
  return [...v].length
}

/** A rename is valid when it is non-blank and within the code-point cap. */
export function isValidTitle(v: string): boolean {
  const trimmed = v.trim()
  return (
    trimmed.length > 0 && titleLength(trimmed) <= CONVERSATION_TITLE_MAX_LENGTH
  )
}

/**
 * Derives a title from the first user message: normalize, then — when longer
 * than the cap — cut the CONTENT to at most `CONVERSATION_TITLE_MAX_LENGTH -
 * ELLIPSIS` code points on a word boundary (breaking at the last space within
 * that window; a single over-long word is hard-cut at that window). The
 * `"..."` is appended after the cut, so the FULL result is always ≤ the cap —
 * an auto-derived title therefore always passes `isValidTitle`. `"..."` is
 * added only when truncation actually removed characters. A pure-whitespace
 * opener yields the fixed `"New conversation"` fallback.
 */
export function deriveTitle(firstUserMessage: string): string {
  const normalized = normalizeTitle(firstUserMessage)
  if (normalized === '') return NEW_CONVERSATION

  const points = [...normalized]
  if (points.length <= CONVERSATION_TITLE_MAX_LENGTH) return normalized

  // Reserve room for the ellipsis so `content + "..."` still fits the cap.
  const limit = CONVERSATION_TITLE_MAX_LENGTH - [...ELLIPSIS].length
  const head = points.slice(0, limit)
  const lastSpace = head.lastIndexOf(' ')
  // Prefer the last word boundary within the window; if the first word already
  // exceeds it (no interior space), hard-cut at the window's code-point limit.
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head
  return `${cut.join('')}${ELLIPSIS}`
}
