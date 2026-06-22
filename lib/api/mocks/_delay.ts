/**
 * Single source of truth for mock latency. Default is 0 (instant) so dev
 * navigation is snappy. Set MOCK_DELAY_MS in `.env.local` to simulate a
 * slow backend (useful when you want to see the route skeletons).
 */
const RAW = process.env.MOCK_DELAY_MS
const DEFAULT_MS = RAW ? Math.max(0, Number(RAW)) : 0

export function mockDelay(ms: number = DEFAULT_MS): Promise<void> {
  if (!ms || Number.isNaN(ms)) return Promise.resolve()
  return new Promise((r) => setTimeout(r, ms))
}
