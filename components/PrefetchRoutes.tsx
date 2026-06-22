'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/**
 * Best-effort warm-up: after the layout mounts, prefetch the most likely
 * next routes during browser idle time. In production Next.js already
 * prefetches links visible in the viewport, but doing it explicitly helps
 * dev mode and routes that aren't linked from the current page.
 */
const DEFAULT_ROUTES = [
  '/',
  '/login',
  '/register',
  '/cart',
  '/checkout',
  '/orders',
  '/loyalty',
  '/admin',
  '/admin/users',
] as const

export function PrefetchRoutes({
  paths = DEFAULT_ROUTES as unknown as string[],
}: {
  paths?: string[]
}) {
  const router = useRouter()

  useEffect(() => {
    const schedule = (cb: () => void) => {
      if (
        typeof window !== 'undefined' &&
        'requestIdleCallback' in window
      ) {
        ;(window as Window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number
        }).requestIdleCallback(cb, { timeout: 2000 })
      } else {
        setTimeout(cb, 600)
      }
    }
    schedule(() => {
      for (const path of paths) {
        router.prefetch(path)
      }
    })
  }, [router, paths])

  return null
}
