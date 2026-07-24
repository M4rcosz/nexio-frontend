import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminAiLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <SkeletonCard className="p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-11 w-full rounded-xl" />
      </SkeletonCard>
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
            <Skeleton className="mt-3 h-10 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>

      {/* Access (revoke / reinstate) */}
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-20" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
      </SkeletonCard>

      {/* Usage report: filter bar + table */}
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-64" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </SkeletonCard>
      <SkeletonCard className="p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mt-3 h-10 w-full first:mt-0" />
        ))}
      </SkeletonCard>
    </div>
  )
}
