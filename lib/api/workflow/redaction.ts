// §2.1 of nexio-workflow's docs/FRONTEND-INTEGRATION.md — the trap that
// silently destroys a user's credentials if you get it wrong.
//
// Reads MASK credential-shaped values: `headers.Authorization`, anything named
// `token`, `apiKey`, `password` or `secret`, and the query parameters and
// userinfo inside `url`. What arrives is the literal string `***REDACTED***`.
// Writes REJECT that marker, deliberately — accepting it would overwrite the
// real credential with the mask. So the read/edit/save loop that posts the whole
// object back FAILS, and it fails for a good reason.
//
// The preferred fix is to send only the fields the user actually edited (the
// update mutation is a partial patch — §2.2). `stripRedacted` is the
// belt-and-braces second line for when a whole object must go out, and
// `containsRedacted` is the assertion a write path runs before calling upstream.
//
// ---------------------------------------------------------------------------
// NOTE: the snippet printed in §2.1 of that document is subtly WRONG and is not
// what is implemented here. It does:
//
//     Array.isArray(v) ? v.map(stripRedacted) : …
//
// which recurses into each element but only ever drops marker values found as
// *object entries*. An array element that is itself the marker falls through to
// the scalar branch and is returned unchanged, so
// `{ headers: { 'X-Api-Key': ['***REDACTED***'] } }` still ships the marker and
// the write is refused (or, worse, a future lenient server stores it). This
// implementation drops marker elements from arrays as well.
// ---------------------------------------------------------------------------

/** The literal string a masked value is replaced with on read. */
export const REDACTED_MARKER = '***REDACTED***'

/**
 * True only for a value that is *exactly* the marker.
 *
 * Exactness matters both ways. `'Bearer ***REDACTED***'` is **not** a mask — the
 * service masks a whole value, never a fragment — so a user who genuinely typed
 * that string keeps it, and stripping it would silently delete real input.
 */
export function isRedacted(value: unknown): boolean {
  return value === REDACTED_MARKER
}

/**
 * Returns a copy of `value` with every masked value removed:
 *
 * - an object entry whose value is the marker is **omitted** (the key too — an
 *   omitted key means "leave as it is", §2.2, which is exactly the intent);
 * - an array element that is the marker is **dropped**, shortening the array
 *   (the case the document's own snippet misses);
 * - a marker appearing as an object **key** is kept — a key named
 *   `***REDACTED***` is odd but it is not a masked credential, and dropping it
 *   would discard whatever real value it holds;
 * - anything else — strings, numbers, booleans, `null`, `undefined` — is
 *   returned as-is.
 *
 * The marker passed in as the root value is the one case with nothing to remove
 * it from, so it returns `undefined`. That keeps the invariant that matters:
 * `containsRedacted(stripRedacted(v))` is always `false`.
 */
export function stripRedacted(value: unknown): unknown {
  if (isRedacted(value)) return undefined

  if (Array.isArray(value)) {
    return value
      .filter((element) => !isRedacted(element))
      .map((element) => stripRedacted(element))
  }

  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      // Filter on the raw entry before recursing: the recursion never needs to
      // report "this whole value disappeared" back to its caller.
      if (isRedacted(entry)) continue
      out[key] = stripRedacted(entry)
    }
    return out
  }

  return value
}

/**
 * True when the marker appears anywhere in `value` as a value — at the root, as
 * an object entry, or as an array element. Object **keys** are not checked, for
 * the same reason `stripRedacted` keeps them.
 *
 * Use this as a pre-flight assertion in every write path: a request that still
 * carries the marker will be refused upstream, and refusing it locally turns a
 * confusing round trip into a precise error before the credential is at risk.
 */
export function containsRedacted(value: unknown): boolean {
  if (isRedacted(value)) return true
  if (Array.isArray(value)) return value.some(containsRedacted)
  if (isPlainRecord(value)) return Object.values(value).some(containsRedacted)
  return false
}

/**
 * Objects only — `null` is `typeof 'object'`, and an array has its own branch in
 * both walkers above.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
