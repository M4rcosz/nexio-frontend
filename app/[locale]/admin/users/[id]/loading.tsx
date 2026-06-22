import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function EditUserLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonCard className="space-y-4 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
