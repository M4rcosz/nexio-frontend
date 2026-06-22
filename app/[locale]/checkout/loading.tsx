import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function CheckoutLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <SkeletonCard className="space-y-2 p-5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-2/3" />
          </SkeletonCard>

          <SkeletonCard className="p-5">
            <Skeleton className="h-3 w-12" />
            <ul className="mt-3 divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-16" />
                </li>
              ))}
            </ul>
          </SkeletonCard>

          <SkeletonCard className="space-y-2 p-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </SkeletonCard>
        </div>

        <SkeletonCard className="sticky top-24 h-max overflow-hidden p-0">
          <div className="space-y-2 border-b border-border p-5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-3 p-5">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  )
}
