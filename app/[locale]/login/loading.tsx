import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function LoginLoading() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <SkeletonCard className="p-7">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <Skeleton className="mt-5 h-4 w-1/2" />
      </SkeletonCard>
    </div>
  )
}
