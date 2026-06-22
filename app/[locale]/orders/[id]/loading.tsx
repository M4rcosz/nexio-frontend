import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-72" />
      </div>

      {/* Status timeline -------------------------------------------- */}
      <SkeletonCard className="p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </ol>
      </SkeletonCard>

      {/* Items list ------------------------------------------------- */}
      <SkeletonCard className="overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <Skeleton className="h-3 w-16" />
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-border bg-surface-2 px-5 py-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-28" />
        </div>
      </SkeletonCard>
    </div>
  )
}
