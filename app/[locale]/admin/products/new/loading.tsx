import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { ProductFormFieldsSkeleton } from '@/components/admin/ProductFormFieldsSkeleton'

export default function NewProductLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonCard className="max-w-3xl space-y-4 p-6">
        <ProductFormFieldsSkeleton />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </SkeletonCard>
    </div>
  )
}
