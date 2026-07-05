import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonCard className="overflow-hidden p-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 first:border-t-0"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}
