import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminCustomersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-xl" />
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      <SkeletonCard className="overflow-hidden p-0">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr] items-center gap-2 border-t border-border px-4 py-3"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}
