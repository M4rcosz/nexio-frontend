'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import type { CursorPageError } from './useCursorPages'

/**
 * "Load more" control for the cursor-paginated admin listings.
 *
 * The status line is a live region so screen-reader users hear the list grow
 * after a page is appended — the newly inserted rows are below the button and
 * are otherwise announced by nothing.
 */
export function LoadMore({
  hasMore,
  loading,
  error,
  loaded,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  error: CursorPageError | null
  /** Number of rows currently rendered, announced after each append. */
  loaded: number
  onLoadMore: () => void
}) {
  const t = useTranslations('admin.pagination')
  const errorMessage = useErrorMessage()

  const buttonRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const wasFocused = useRef(false)

  // When the final page exhausts the cursor the button unmounts. If it held
  // focus, focus would fall back to <body> and the next Tab would restart from
  // the top of the document, past every row the user just loaded. Move focus
  // to the status line instead so their place is preserved.
  useEffect(() => {
    if (hasMore) {
      wasFocused.current = document.activeElement === buttonRef.current
      return
    }
    if (wasFocused.current) {
      wasFocused.current = false
      statusRef.current?.focus()
    }
  }, [hasMore])

  const message = error
    ? (errorMessage(error.code, error.status) ?? t('loadMoreFailed'))
    : null

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {/* Suppressed at zero: "0 shown" directly above an empty-state card is
          noise, and it would also announce on first mount. */}
      {loaded > 0 ? (
        <p
          ref={statusRef}
          tabIndex={-1}
          aria-live="polite"
          className="text-xs text-fg-subtle outline-none"
        >
          {t('loaded', { count: loaded })}
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-xs text-accent-600">
          {message}
        </p>
      ) : null}
      {hasMore ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          // The accessible name stays "Load more" while loading — swapping it
          // to "Loading…" mid-press is re-announced as a different control.
          // `aria-busy` carries the pending state instead.
          aria-busy={loading}
          className="btn-secondary min-h-[44px] disabled:opacity-50"
        >
          {t('loadMore')}
        </button>
      ) : null}
    </div>
  )
}
