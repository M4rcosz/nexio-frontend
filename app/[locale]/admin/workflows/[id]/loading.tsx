import { Fragment } from 'react'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

/**
 * Mirrors `page.tsx`: back link, title + toggle, the two-up
 * `lg:grid-cols-2` pair of metadata cards, then the node list. The card bodies
 * match too — a matching grid with the wrong card shape still shifts the layout
 * when the real content lands.
 */
export default function AdminWorkflowDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, card) => (
          <SkeletonCard key={card} className="space-y-3 p-5">
            <Skeleton className="h-3 w-24" />
            {/* Same dt/dd pairs in the same two-column template as the `dl`. */}
            <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
              {Array.from({ length: 4 }).map((_, row) => (
                <Fragment key={row}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-2/3" />
                </Fragment>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[8rem_1fr]">
                {Array.from({ length: 3 }).map((_, row) => (
                  <Fragment key={row}>
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-3/4" />
                  </Fragment>
                ))}
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
