'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Paginated } from '@/lib/api/types'

/**
 * Drives a "Load more" control over the API's cursor envelope.
 *
 * The first page is rendered on the server and handed in as `initialPage`;
 * this hook only owns the pages appended after it. The backend has no
 * offset/page-number pagination, so `meta.nextCursor` is the only way
 * forward — when `hasMore` is false the cursor is null and we stop.
 *
 * Whenever `initialPage` changes identity (a new server render after the
 * filters moved), the appended pages are dropped so stale rows from the
 * previous query cannot linger below the fresh first page.
 */
export function useCursorPages<T>({
  endpoint,
  query,
  initialPage,
}: {
  /** Same-origin route handler path, e.g. `/api/admin/users`. */
  endpoint: string
  /** Filter params to repeat on every follow-up request. */
  query: Record<string, string | undefined>
  initialPage: Paginated<T>
}) {
  const [extra, setExtra] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(
    initialPage.meta.nextCursor,
  )
  const [hasMore, setHasMore] = useState(initialPage.meta.hasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Bumped on every reset. A request captures the value at send time and
   * discards its own response if it no longer matches — without this, a fetch
   * still in flight when the filters move lands *after* the reset and both
   * appends rows from the previous query and overwrites the fresh cursor,
   * so every later page walks the old query while sending the new params.
   * Checking it at entry also closes the double-click window, since `loading`
   * is captured in the callback closure and two clicks in one batch both read
   * it as false.
   */
  const generation = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    generation.current += 1
    inFlight.current = false
    setExtra([])
    setCursor(initialPage.meta.nextCursor)
    setHasMore(initialPage.meta.hasMore)
    setError(null)
    setLoading(false)
  }, [initialPage])

  const serializedQuery = JSON.stringify(query)

  const loadMore = useCallback(async () => {
    if (inFlight.current || loading || !hasMore || !cursor) return
    inFlight.current = true
    const mine = generation.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(
        JSON.parse(serializedQuery) as Record<string, string | undefined>,
      )) {
        if (value) params.set(key, value)
      }
      params.set('cursor', cursor)
      const res = await fetch(`${endpoint}?${params.toString()}`)
      // The filters moved while this was in flight — this response describes a
      // query the user has already navigated away from. Drop it entirely.
      if (mine !== generation.current) return
      if (!res.ok) {
        // Only a 4xx means the cursor itself is dead; retrying it would just
        // fail again, so stop offering the control. A 5xx is transient, so
        // keep the button alive and let the user retry rather than forcing a
        // full page reload.
        if (res.status < 500) setHasMore(false)
        setError('failed')
        return
      }
      const page = (await res.json()) as Paginated<T>
      if (mine !== generation.current) return
      setExtra((prev) => [...prev, ...page.data])
      setCursor(page.meta.nextCursor)
      setHasMore(page.meta.hasMore && Boolean(page.meta.nextCursor))
    } catch {
      // A thrown fetch is a network blip, not a rejected cursor — recoverable,
      // so the control stays.
      if (mine !== generation.current) return
      setError('failed')
    } finally {
      if (mine === generation.current) {
        inFlight.current = false
        setLoading(false)
      }
    }
  }, [cursor, endpoint, hasMore, loading, serializedQuery])

  return {
    items: [...initialPage.data, ...extra],
    hasMore,
    loading,
    error,
    loadMore,
  }
}
