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
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired. Please sign in again.'
    if (err.status === 403) return "You don't have permission to perform this action."
    if (err.status === 404) return 'Resource not found.'
    if (err.status >= 500)
      return 'The server did not respond properly. Please try again shortly.'
    // Other generic 4xx: never echo the raw backend message — it may leak
    // internal details. Known cases (401/403/404 above, and coded errors such
    // as 409 username_taken) are handled by their own branches or by callers
    // that key off the error `code`, not this message.
    if (err.status >= 400) return 'Invalid request.'
  }
  if (err instanceof Error) return err.message
  return 'Unknown error.'
}
