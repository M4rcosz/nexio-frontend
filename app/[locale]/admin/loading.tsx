import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="space-y-2 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-40" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
