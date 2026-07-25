import { Skeleton, SkeletonCard } from '@/components/Skeleton'

export default function AiLoading() {
  return (
    <div className="space-y-6">
      {/* Title block left, token balance right — same row as the loaded page. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-36 rounded-2xl" />
      </div>

      {/* Mirrors AiAssistantView: two panes, side column pinned from xl. */}
      <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-[20rem_1fr]">
        <div className="space-y-5">
          {/* Only the conversation list — the access-state card renders solely
              when the wallet is blocked, which is not the common case. */}
          <SkeletonCard className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-9 w-full rounded-lg" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </SkeletonCard>
        </div>

        <SkeletonCard className="flex min-h-[28rem] flex-col p-6 md:col-span-2 xl:col-span-1">
          {/* The message column is capped even as the pane widens… */}
          <div className="mx-auto w-full max-w-[75ch] flex-1 space-y-4">
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
          </div>
          {/* …but the composer spans the pane and pins to the bottom, with the
              send button inside the field. */}
          <div className="relative mt-6">
            <Skeleton className="h-11 w-full rounded-3xl" />
            <Skeleton className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  )
}
