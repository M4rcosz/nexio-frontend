import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminBusinessUnitsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 w-full rounded-xl sm:max-w-sm" />
        <Skeleton className="h-10 w-full rounded-xl sm:max-w-[200px]" />
        <Skeleton className="h-10 w-full rounded-xl sm:max-w-[180px]" />
      </div>

      <Skeleton className="h-3 w-32" />

      {/* Mobile: card skeletons */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>

      {/* Tablet/desktop: table skeleton */}
      <SkeletonCard className="hidden overflow-hidden p-0 md:block">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_0.8fr_1fr_1fr] items-center gap-2 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <div className="flex justify-end">
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}
