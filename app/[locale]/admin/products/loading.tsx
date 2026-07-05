import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AdminProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <SkeletonCard className="hidden overflow-hidden p-0 md:block">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3 w-1/2" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex justify-end">
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </SkeletonCard>

      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
