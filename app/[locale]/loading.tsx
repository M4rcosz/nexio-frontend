import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function HomeLoading() {
  return (
    <div className="space-y-12">
      {/* Hero skeleton --------------------------------------------------- */}
      <SkeletonCard className="h-[320px] sm:h-[360px] lg:h-[400px]">
        <div
          className="grain absolute inset-0 bg-brand-gradient opacity-60"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" />
        <div className="relative flex h-full flex-col justify-center gap-4 px-6 sm:px-12">
          <Skeleton variant="light" className="h-6 w-44 rounded-full" />
          <Skeleton variant="light" className="h-10 w-3/4 max-w-xl" />
          <Skeleton variant="light" className="h-10 w-2/3 max-w-md" />
          <Skeleton variant="light" className="h-4 w-2/3 max-w-lg" />
          <Skeleton variant="light" className="h-12 w-44 rounded-xl" />
        </div>
      </SkeletonCard>

      {/* Units list ------------------------------------------------------ */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <ul className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <SkeletonCard className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="mt-5 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
                  <Skeleton className="h-10 flex-1 rounded-xl" />
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </SkeletonCard>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
