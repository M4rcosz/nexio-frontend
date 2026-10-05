import { serverFetchAnonymous, USE_MOCKS } from './client'

/** Short on purpose: this is a probe, not a page load. A sleeping Render
 * instance holds the request for the whole cold start (~30–60s), so "no answer
 * within a few seconds" is exactly the signal we want — not a failure to wait
 * out. The browser keeps polling until it flips to `up`. */
const HEALTH_TIMEOUT_MS = 3000

export type BackendHealth = 'up' | 'down'

/**
 * `GET /health` on nexio-core — the public liveness probe (no auth, no DB
 * touch, skips the rate limit). Never throws: any error, non-2xx or timeout is
 * `down`. With mocks on there is no backend to wait for, so it's always `up`.
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  if (USE_MOCKS) return 'up'
  try {
    await serverFetchAnonymous('/health', {
      cache: 'no-store',
      timeoutMs: HEALTH_TIMEOUT_MS,
    })
    return 'up'
  } catch {
    return 'down'
  }
}
