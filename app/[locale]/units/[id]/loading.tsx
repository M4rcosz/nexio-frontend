import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function MenuLoading() {
  return (
    <div className="space-y-8">
      {/* Unit hero ------------------------------------------------------- */}
      <SkeletonCard className="overflow-hidden">
        <div className="absolute inset-0 bg-brand-soft" aria-hidden />
        <div className="relative flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </SkeletonCard>

      {/* Menu ------------------------------------------------------------ */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full max-w-sm rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-7 rounded-full"
              style={{ width: `${60 + ((i * 17) % 60)}px` }}
            />
          ))}
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <SkeletonCard className="flex h-full flex-col">
                <Skeleton className="aspect-[16/10] w-full !rounded-none" />
                <div className="space-y-2.5 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                  <div className="flex items-end justify-between gap-2 pt-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-2.5 w-12" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-9 w-28 rounded-xl" />
                  </div>
                </div>
              </SkeletonCard>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
