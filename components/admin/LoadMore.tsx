'use client'

import { useTranslations } from 'next-intl'

/**
 * "Load more" control for the cursor-paginated admin listings. The status
 * line is a live region so screen-reader users hear the count grow after a
 * page is appended — the newly inserted rows are below the button and are
 * otherwise silent.
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
  error: string | null
  /** Number of rows currently rendered, announced after each append. */
  loaded: number
  onLoadMore: () => void
}) {
  const t = useTranslations('admin.pagination')

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p aria-live="polite" className="text-xs text-fg-subtle">
        {t('loaded', { count: loaded })}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-accent-600">
          {t('loadMoreFailed')}
        </p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="btn-secondary min-h-[44px] disabled:opacity-50"
        >
          {loading ? t('loading') : t('loadMore')}
        </button>
      ) : null}
    </div>
  )
}
