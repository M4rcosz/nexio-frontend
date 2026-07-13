export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static fromUnknown(err: unknown): ApiError {
    if (err instanceof ApiError) return err
    if (err instanceof Error) return new ApiError(0, null, err.message)
    return new ApiError(0, null, 'Unknown error')
  }
}

/**
 * Converts an arbitrary error into a short, user-friendly English string.
 * The client side may further translate it via the i18n message catalog
 * before showing it to the user.
 */
const GENERIC_SERVER_MESSAGE =
  'The server did not respond properly. Please try again shortly.'

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired. Please sign in again.'
    if (err.status === 403)
      return "You don't have permission to perform this action."
    if (err.status === 404) return 'Resource not found.'
    if (err.status >= 500) return GENERIC_SERVER_MESSAGE
    // Other generic 4xx: never echo the raw backend message — it may leak
    // internal details. Known cases (401/403/404 above, and coded errors such
    // as 409 username_taken) are handled by their own branches or by callers
    // that key off the error `code`, not this message.
    if (err.status >= 400) return 'Invalid request.'
    // Falsy/<400 status (e.g. a network failure surfaced as ApiError(0, ...,
    // 'Network failure: host:port')): the raw message can leak the internal
    // backend host, so stay generic.
    return GENERIC_SERVER_MESSAGE
  }
  // Any non-ApiError (raw Error/thrown value): never surface its message —
  // it may carry internal details. Callers that need a specific 4xx/credential
  // wording rely on the ApiError branches above, not on this fallback.
  return GENERIC_SERVER_MESSAGE
}

/**
 * The HTTP status a BFF route handler should respond with for an arbitrary
 * thrown error, once its own known cases (401/403/404, coded 4xx) are handled:
 * propagate a genuine upstream 4xx as-is so the client can react to it, and
 * collapse any 5xx — or a non-ApiError / unknown failure — into 502 (Bad
 * Gateway), so a transient upstream 500 or an internal error is never surfaced
 * as our own 500. Shared by every order/payment handler to keep the fallback
 * mapping identical across sibling endpoints.
 */
export function backendErrorStatus(err: unknown): number {
  const status = err instanceof ApiError ? err.status || 500 : 500
  return status >= 500 ? 502 : status
}
