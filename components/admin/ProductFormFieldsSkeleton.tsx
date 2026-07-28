import { Skeleton } from '@/components/Skeleton'

/**
 * Mirrors `ProductForm`'s field layout for the create and edit `loading.tsx`.
 *
 * Shared rather than duplicated because the shape is not a uniform stack and
 * so is easy to get wrong twice: the description is a `min-h-[96px]` textarea
 * with a hint under it, and price/category sit side by side in a
 * `sm:grid-cols-2` row. A stack of four identical label+input rows is both too
 * short (description) and too tall (the grid row) on the same card.
 *
 * The image is not a field here — it is attached on the detail page, after the
 * product exists.
 */
function Field({ inputClassName = 'h-10', hint = false }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className={`${inputClassName} w-full rounded-xl`} />
      {hint ? <Skeleton className="h-3 w-2/3" /> : null}
    </div>
  )
}

export function ProductFormFieldsSkeleton() {
  return (
    <>
      <Field />
      <Field inputClassName="h-24" hint />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field hint />
        <Field hint />
      </div>
    </>
  )
}
