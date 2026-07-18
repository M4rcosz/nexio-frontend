'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

// Next.js's client Router Cache reuses the root layout's last render (where
// Header reads the session cookie) across soft <Link> navigations, so once
// the access token expires while the user sits on a page, the avatar and
// staff nav keep showing until something forces a fresh server render — a
// hard reload does it, but nothing else naturally does. router.refresh() is
// the documented way to force that re-render without discarding client
// state (scroll position, open menus elsewhere); this just calls it at the
// moments a stale session is most likely to surface — tab refocus and a
// periodic fallback for a tab left open and active.
const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function SessionWatcher() {
  const router = useRouter()

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const interval = setInterval(refreshIfVisible, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', refreshIfVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.removeEventListener('focus', refreshIfVisible)
    }
  }, [router])

  return null
}
