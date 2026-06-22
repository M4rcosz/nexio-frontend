type DivProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Use the lighter shimmer for blocks placed on top of the brand gradient. */
  variant?: 'default' | 'light'
}

/**
 * Visual placeholder that animates a shimmer while data loads. Pair with
 * Tailwind sizing utilities (h-*, w-*, rounded-*) to mirror the real layout.
 */
export function Skeleton({
  className = '',
  variant = 'default',
  ...props
}: DivProps) {
  const base = variant === 'light' ? 'skeleton-light' : 'skeleton'
  return <div aria-hidden className={`${base} ${className}`} {...props} />
}

/** Skeleton variant that matches the .card surface (rounded-2xl + border). */
export function SkeletonCard({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
      {...props}
    />
  )
}
