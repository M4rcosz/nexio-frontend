/**
 * Client-side view of "is the backend awake?".
 *
 * nexio-core runs on Render's free tier, which spins the instance down after
 * ~15 min without traffic; the next request then waits through a cold start of
 * roughly a minute. Server renders give up long before that (the 4s timeout in
 * `lib/api/client.ts`), so a first visitor would otherwise just see the error
 * page. This store polls `/api/backend-status` until the backend answers, so
 * the UI can say what's happening and recover by itself once it's up.
 *
 * One module-level instance is shared by the wake toast and the error boundary
 * so there is only ever one poller, however many components subscribe.
 */

export type BackendPhase =
  /** Nothing checked yet (also the SSR snapshot). */
  | 'idle'
  /** First probe in flight — shows nothing, most loads end here as `up`. */
  | 'checking'
  | 'up'
  /** Probe failed; polling until it answers or we give up. */
  | 'waking'
  /** Gave up after `giveUpAfterMs`; a manual retry restarts polling. */
  | 'unavailable'

export type BackendStatusSnapshot = {
  phase: BackendPhase
  /**
   * Timestamp of the last down → up transition, `null` if there never was
   * one. Subscribers key their "refresh the page" effect on this, so a backend
   * that was simply up all along never triggers a refresh.
   */
  wokeAt: number | null
}

type Options = {
  probe: () => Promise<boolean>
  pollIntervalMs?: number
  giveUpAfterMs?: number
  /** `checkIfStale` re-probes only when the last probe is older than this. */
  staleAfterMs?: number
  now?: () => number
}

export const IDLE_SNAPSHOT: BackendStatusSnapshot = {
  phase: 'idle',
  wokeAt: null,
}

export function createBackendStatusStore({
  probe,
  pollIntervalMs = 4_000,
  // Render cold starts are usually under a minute; double it before calling
  // the backend unavailable rather than merely asleep.
  giveUpAfterMs = 120_000,
  // Render sleeps after 15 min idle — re-probe a refocused tab a bit before.
  staleAfterMs = 10 * 60_000,
  now = () => Date.now(),
}: Options) {
  let snapshot = IDLE_SNAPSHOT
  let running = false
  let lastCheckedAt = 0
  const listeners = new Set<() => void>()

  function set(next: Partial<BackendStatusSnapshot>) {
    snapshot = { ...snapshot, ...next }
    listeners.forEach((l) => l())
  }

  /** Probe now and keep polling while down. Concurrent calls coalesce. */
  async function check(): Promise<void> {
    if (running) return
    running = true
    const startedAt = now()
    // Retrying from `unavailable` should show progress straight away.
    let wasDown = snapshot.phase === 'unavailable'
    set({
      phase: wasDown
        ? 'waking'
        : snapshot.phase === 'idle'
          ? 'checking'
          : snapshot.phase,
    })
    try {
      for (;;) {
        lastCheckedAt = now()
        if (await probe()) {
          set({ phase: 'up', wokeAt: wasDown ? now() : snapshot.wokeAt })
          return
        }
        if (!wasDown) {
          wasDown = true
          set({ phase: 'waking' })
        }
        if (now() - startedAt >= giveUpAfterMs) {
          set({ phase: 'unavailable' })
          return
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs))
      }
    } finally {
      running = false
    }
  }

  /** For tab refocus: cheap no-op unless the last answer is getting old. */
  function checkIfStale(): Promise<void> {
    if (snapshot.phase !== 'up' || now() - lastCheckedAt >= staleAfterMs) {
      return check()
    }
    return Promise.resolve()
  }

  return {
    check,
    checkIfStale,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type BackendStatusStore = ReturnType<typeof createBackendStatusStore>

async function probeBackendStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/backend-status', { cache: 'no-store' })
    if (!res.ok) return false
    const body = (await res.json()) as { status?: unknown }
    return body.status === 'up'
  } catch {
    return false
  }
}

export const backendStatus = createBackendStatusStore({
  probe: probeBackendStatus,
})
