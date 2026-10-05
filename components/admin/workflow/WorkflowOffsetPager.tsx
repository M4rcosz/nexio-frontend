'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  hasNextWorkflowPage,
  previousWorkflowOffset,
  type WorkflowPaging,
} from '@/lib/api/workflow/paging'

/**
 * Prev/next by offset — not the cursor pager used everywhere else in this repo.
 *
 * `workflows` and `executions` return a **bare array** with no total and no
 * envelope (§4), so there is nothing to build a page count from: "next" is
 * offered whenever the page came back full, and the accepted cost is one extra
 * click that lands on an empty page. Both bounds come from
 * `lib/api/workflow/paging.ts`, the same helpers the read clamps with, so a
 * hand-edited `?offset=` can never produce the `BAD_REQUEST` of §2.6.
 */
export function WorkflowOffsetPager({
  basePath,
  paging,
  itemCount,
}: {
  basePath: string
  paging: WorkflowPaging
  itemCount: number
}) {
  const t = useTranslations('admin.workflows')

  const hasPrevious = paging.offset > 0
  const hasNext = hasNextWorkflowPage(itemCount, paging)
  if (!hasPrevious && !hasNext) return null

  // The first page keeps a bare URL — `?offset=0` is noise in a shared link.
  const href = (offset: number) =>
    offset === 0 ? basePath : `${basePath}?offset=${offset}`

  return (
    <nav
      aria-label={t('pagerLabel')}
      className="flex items-center justify-between gap-3"
    >
      {hasPrevious ? (
        <Link
          href={href(previousWorkflowOffset(paging))}
          className="btn-secondary text-sm"
          rel="prev"
        >
          {t('pagerPrevious')}
        </Link>
      ) : (
        <span />
      )}

      {itemCount > 0 ? (
        <p className="text-xs text-fg-subtle">
          {t('pagerPosition', {
            from: paging.offset + 1,
            to: paging.offset + itemCount,
          })}
        </p>
      ) : null}

      {hasNext ? (
        <Link
          href={href(paging.offset + paging.limit)}
          className="btn-secondary text-sm"
          rel="next"
        >
          {t('pagerNext')}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
