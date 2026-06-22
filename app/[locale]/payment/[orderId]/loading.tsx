import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function PaymentLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      {/* Order summary chip ------------------------------------------ */}
      <SkeletonCard className="grid gap-3 p-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </SkeletonCard>

      {/* Payment box ------------------------------------------------- */}
      <SkeletonCard className="overflow-hidden p-0">
        <div className="space-y-2 border-b border-border p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="space-y-4 p-5">
          <Skeleton className="h-3 w-32" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
