'use client'

import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'

/**
 * Standard filters toolbar: a search field that grows to fill the row plus
 * fixed-width secondary controls. Syncs the given values into the URL query
 * string, debounced. Empty values are dropped from the URL.
 */
export function FilterBar({
  values,
  children,
}: {
  /** Query param name → current value. */
  values: Record<string, string>
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const serialized = JSON.stringify(values)

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(
        JSON.parse(serialized) as Record<string, string>,
      )) {
        if (value) params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {children}
    </div>
  )
}

/** Search input styled to grow and fill the toolbar's free space. */
export function FilterSearch(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input sm:min-w-0 sm:flex-1" {...props} />
}

/** Fixed-width slot for a secondary control (a Select or a narrow input). */
export function FilterControl({
  width = 'sm:w-44',
  children,
}: {
  /** Tailwind width class applied from the `sm` breakpoint up. */
  width?: string
  children: ReactNode
}) {
  return <div className={`${width} sm:flex-none`}>{children}</div>
}
