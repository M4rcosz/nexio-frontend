'use client'

import { useTranslations } from 'next-intl'

/**
 * Maps an HTTP status to a generic, localizable error code. Used as a fallback
 * when the backend/route did not return an explicit machine `code`, so we can
 * still show a translated message instead of echoing a raw English string.
 *
 * 400 is intentionally left out: a generic 400 usually means a context-specific
 * validation problem, so we let the calling component pick its own fallback
 * (e.g. "Failed to create order") rather than a vague "invalid request".
 */
const STATUS_TO_CODE: Record<number, string> = {
  401: 'session_expired',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
}

/**
 * Hook that turns an API error (machine `code` + HTTP status) into a message in
 * the user's language. Deliberately ignores the backend's human-readable
 * `message`/`error` text — those may be English or leak internals (JWT, stack
 * traces). Translation is keyed off the stable `code`, never the message.
 *
 * Returns `null` when nothing specific applies, so callers can fall back to
 * their own context-specific translated string.
 *
 * @example
 *   const errorMessage = useErrorMessage()
 *   setError(errorMessage(body?.code, res.status) ?? t('failed'))
 */
export function useErrorMessage() {
  const t = useTranslations('errors.codes')

  return (code?: string | null, status?: number): string | null => {
    if (code && t.has(code)) return t(code)
    if (status !== undefined) {
      if (status >= 500) return t('server')
      const mapped = STATUS_TO_CODE[status]
      if (mapped) return t(mapped)
    }
    return null
  }
}
