import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function ProductDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <SkeletonCard className="grid gap-0 overflow-hidden md:grid-cols-2">
        <Skeleton className="aspect-[4/3] w-full !rounded-none md:aspect-auto" />
        <div className="space-y-4 p-7 sm:p-9">
          <Skeleton className="h-3 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-9 w-1/2" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="mt-6 h-10 w-40" />
          <Skeleton className="mt-4 h-12 w-full rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
