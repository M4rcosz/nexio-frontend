import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AiLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-80" />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-5">
          <SkeletonCard className="h-max p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-12 w-32" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </SkeletonCard>

          {/* Conversation list */}
          <SkeletonCard className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-9 w-full rounded-lg" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </SkeletonCard>
        </div>

        <SkeletonCard className="p-6 md:col-span-2">
          <div className="space-y-4">
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
          </div>
          <Skeleton className="mt-6 h-12 w-full rounded-xl" />
        </SkeletonCard>
      </div>
    </div>
  )
}
