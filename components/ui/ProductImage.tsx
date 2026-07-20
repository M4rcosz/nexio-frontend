'use client'

import { useEffect, useState } from 'react'

/**
 * Renders a product image and swaps in the placeholder emoji when the URL is
 * missing, empty or fails to load (404, broken host, blocked request).
 */
export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName = 'text-6xl opacity-80',
  fallbackEmoji = '🍲',
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  /** Placeholder glyph; callers use a smaller/different one in dense lists. */
  fallbackEmoji?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <span className={fallbackClassName} aria-hidden>
        {fallbackEmoji}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
