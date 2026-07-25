import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { ProductFormFieldsSkeleton } from '@/components/admin/ProductFormFieldsSkeleton'

export default function EditProductLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Image manager: heading + hint, then the 4:3 preview beside its
          controls. Mirrors ProductImageManager so the card doesn't jump
          height when the real one arrives. */}
      <SkeletonCard className="max-w-3xl space-y-4 p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="aspect-[4/3] w-full flex-none rounded-xl sm:w-56" />
          <div className="flex flex-1 gap-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      </SkeletonCard>

      {/* ADMIN-only in the real page — a MANAGER sees this card disappear on
          load. Unavoidable here: `loading.tsx` has no access to the role. */}
      <SkeletonCard className="max-w-3xl space-y-4 p-6">
        <ProductFormFieldsSkeleton />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
