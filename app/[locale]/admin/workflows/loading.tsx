import { Skeleton, SkeletonCard } from '@/components/Skeleton'

/**
 * Mirrors `page.tsx`: header, count line, then the same two presentations
 * `WorkflowList` renders — cards below `md`, the six-column table above it. The
 * column template and the card body have to match, not just the outer grid, or
 * the real list shifts everything when it arrives.
 */
export default function AdminWorkflowsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-3 w-24" />

      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="col-span-2 h-3 w-40" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>

      {/* Tablet/desktop: table */}
      <SkeletonCard className="hidden overflow-hidden p-0 md:block">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.8fr_1.4fr_0.8fr_1.2fr_0.8fr_1fr] items-center gap-2 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex justify-end gap-1">
              <Skeleton className="h-7 w-16 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}
