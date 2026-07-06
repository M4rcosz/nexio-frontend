import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminMenuLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-10 w-full max-w-xs rounded-xl" />

      {/* Mobile: card skeletons */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Tablet/desktop: table skeleton */}
      <SkeletonCard className="hidden overflow-hidden p-0 md:block">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-2 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </SkeletonCard>

      <SkeletonCard className="space-y-4 p-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
