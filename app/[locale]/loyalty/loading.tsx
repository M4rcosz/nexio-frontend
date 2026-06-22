import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function LoyaltyLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <SkeletonCard className="overflow-hidden p-7 md:col-span-2">
          <div
            className="grain pointer-events-none absolute inset-0 bg-brand-gradient opacity-15"
            aria-hidden
          />
          <div className="relative space-y-3">
            <Skeleton className="h-3 w-16" />
            <div className="flex items-baseline gap-3">
              <Skeleton className="h-14 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-8 h-3 w-32" />
            <ul className="mt-3 divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </li>
              ))}
            </ul>
          </div>
        </SkeletonCard>

        <SkeletonCard className="h-max p-6">
          <Skeleton className="h-3 w-32" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="mt-6 h-10 w-full rounded-xl" />
        </SkeletonCard>
      </div>
    </div>
  )
}
