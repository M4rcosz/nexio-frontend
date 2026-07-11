'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/**
 * Warms the client cache for the login and register routes once the home page
 * has mounted. They are the most likely next destinations, so prefetching them
 * in the background makes that first navigation feel instant. The work is
 * deferred to browser idle time so it never competes with the home page's own
 * rendering/data. Renders nothing.
 */
export function PrefetchAuthRoutes() {
  const router = useRouter()

  useEffect(() => {
    const run = () => {
      router.prefetch('/login')
      router.prefetch('/register')
    }
    // Prefer idle time; fall back to a short timeout where it's unavailable.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run)
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(run, 1500)
    return () => window.clearTimeout(id)
  }, [router])

  return null
}
