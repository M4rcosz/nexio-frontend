import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <SkeletonCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </SkeletonCard>
          </li>
        ))}
      </ul>
    </div>
  )
}
