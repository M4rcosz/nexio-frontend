import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function CartLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-44" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <SkeletonCard className="flex items-center justify-between p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-24" />
          </SkeletonCard>

          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="flex gap-4 p-4">
              <Skeleton className="h-24 w-24 flex-none rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Skeleton className="h-9 w-28 rounded-xl" />
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>

        <SkeletonCard className="sticky top-24 h-max overflow-hidden p-0">
          <div className="space-y-3 border-b border-border p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-9 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="p-5">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  )
}
