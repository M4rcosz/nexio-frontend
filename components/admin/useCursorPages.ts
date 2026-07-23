'use client'

import { useCallback, useRef, useState } from 'react'
import type { Paginated } from '@/lib/api/types'

/** Machine `code` and HTTP status of a failed page fetch, for useErrorMessage. */
export type CursorPageError = { code?: string; status?: number }

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
  // Set only after a 422 recovery: the refetched page 1 replaces the whole
  // visible list, server-rendered rows included, because those rows came from
  // the same result set the dead cursor was pointing into.
  const [restarted, setRestarted] = useState<T[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(
    initialPage.meta.nextCursor,
  )
  const [hasMore, setHasMore] = useState(initialPage.meta.hasMore)
  const [loading, setLoading] = useState(false)
  // `{ code, status }` rather than a bare flag, so the component can render a
  // specific message via useErrorMessage — an expired session during
  // pagination must not read as a generic server fault.
  const [error, setError] = useState<CursorPageError | null>(null)

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

  // Resync during render rather than in an effect, matching BusinessUnitList.
  // An effect runs after commit, so there would be one painted frame with the
  // previous query's appended rows sitting below the fresh first page.
  const [syncedFrom, setSyncedFrom] = useState(initialPage)
  if (syncedFrom !== initialPage) {
    generation.current += 1
    inFlight.current = false
    setSyncedFrom(initialPage)
    setExtra([])
    setRestarted(null)
    setCursor(initialPage.meta.nextCursor)
    setHasMore(initialPage.meta.hasMore)
    setError(null)
    setLoading(false)
  }

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
        // 422 means the keyset cursor is stale or malformed — the listing moved
        // underneath us. The token can never be revived, but the listing can:
        // refetch page 1 and replace what is on screen. Retrying the dead
        // cursor, or just stopping, would strand the user mid-list.
        if (res.status === 422) {
          // Same filters, no cursor — that is what "page 1" means here.
          params.delete('cursor')
          const restart = await fetch(`${endpoint}?${params.toString()}`)
          if (mine !== generation.current) return
          if (restart.ok) {
            const page = (await restart.json()) as Paginated<T>
            if (mine !== generation.current) return
            setRestarted(page.data)
            setExtra([])
            setCursor(page.meta.nextCursor)
            setHasMore(page.meta.hasMore && Boolean(page.meta.nextCursor))
            return
          }
          setHasMore(false)
          setError({ code: 'invalid_cursor', status: 422 })
          return
        }
        // Any other 4xx means the request itself is dead; retrying would just
        // fail again, so stop offering the control. A 5xx is transient, so
        // keep the button alive and let the user retry rather than forcing a
        // full page reload. Set this before reading the body: a stubbed or
        // bodyless response must not divert us into the network-blip branch.
        if (res.status < 500) setHasMore(false)
        const body = (await Promise.resolve()
          .then(() => res.json())
          .catch(() => null)) as { code?: string } | null
        setError({ code: body?.code, status: res.status })
        return
      }
      const page = (await res.json()) as Paginated<T>
      if (mine !== generation.current) return
      setExtra((prev) => [...prev, ...page.data])
      setCursor(page.meta.nextCursor)
      setHasMore(page.meta.hasMore && Boolean(page.meta.nextCursor))
    } catch {
      // A thrown fetch is a network blip, not a rejected cursor — recoverable,
      // so the control stays. No status to report.
      if (mine !== generation.current) return
      setError({})
    } finally {
      if (mine === generation.current) {
        inFlight.current = false
        setLoading(false)
      }
    }
  }, [cursor, endpoint, hasMore, loading, serializedQuery])

  return {
    items: restarted
      ? [...restarted, ...extra]
      : [...initialPage.data, ...extra],
    hasMore,
    loading,
    error,
    loadMore,
  }
}
