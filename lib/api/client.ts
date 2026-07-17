import { ApiError } from './errors'
import type { LoginResponse } from './types'

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'nexio_session'

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3000/api'

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

/** Abort any backend call (including refresh) that stalls longer than this. */
const REQUEST_TIMEOUT_MS = 4000

export const SESSION_COOKIE = SESSION_COOKIE_NAME

type FetchInit = Omit<RequestInit, 'body'> & {
  body?: unknown
  query?: Record<string, string | number | undefined>
  // Next-specific fetch options
  next?: { revalidate?: number | false; tags?: string[] }
  /**
   * Override the default abort timeout for this call. Use a longer value for
   * endpoints that legitimately take a beat (e.g. the AI chat, which may run
   * several bounded internal model round-trips server-side).
   */
  timeoutMs?: number
}

function buildUrl(path: string, query?: FetchInit['query']): string {
  const base = path.startsWith('http')
    ? path
    : `${BACKEND_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.append(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }
  const text = await res.text()
  return text || null
}

async function rawFetch<T>(
  url: string,
  init: FetchInit,
  token: string | null,
): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  headers.set('accept', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  // Bound every call with a timeout so a hung backend surfaces as a network
  // ApiError rather than blocking a render/refresh indefinitely. Callers may
  // widen it per-request for slow-but-legitimate endpoints.
  const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const fetchInit: RequestInit = {
    method: init.method ?? 'GET',
    headers,
    cache: init.cache,
    next: init.next,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: controller.signal,
  }

  let res: Response
  try {
    res = await fetch(url, fetchInit)
  } catch (err) {
    const aborted = controller.signal.aborted
    throw new ApiError(
      0,
      null,
      aborted
        ? `Network failure: request timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? `Network failure: ${err.message}`
          : 'Network failure while calling the backend.',
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await parseBody(res)
    const msg =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ?? `HTTP error ${res.status}`
    throw new ApiError(res.status, body, msg)
  }

  if (res.status === 204) return undefined as T
  return (await parseBody(res)) as T
}

/**
 * Coalesces concurrent refreshes so a burst of parallel 401s only hits the
 * backend once. Keyed by the refresh-token value itself — it is unique per user
 * and rotated on every refresh, so there is no cross-user collision. The entry
 * is dropped as soon as the in-flight promise settles. `refreshBackend` is
 * imported lazily to avoid a static import cycle (auth.ts imports this module).
 */
const inflightRefresh = new Map<string, Promise<LoginResponse>>()

/**
 * True only for the specific "cookie store is read-only" error Next throws when
 * `cookies().set` runs during a Server Component render. Every other failure is
 * unexpected and must not be swallowed.
 */
function isReadOnlyCookieStoreError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /cookies can only be modified|can only be modified in a server action or route handler/i.test(
    msg,
  )
}

function dedupedRefresh(refreshToken: string): Promise<LoginResponse> {
  const existing = inflightRefresh.get(refreshToken)
  if (existing) return existing
  const tracked = (async () => {
    const { refreshBackend } = await import('./auth')
    return refreshBackend(refreshToken)
  })().finally(() => {
    inflightRefresh.delete(refreshToken)
  })
  inflightRefresh.set(refreshToken, tracked)
  return tracked
}

/**
 * Server-side fetch — reads JWT from httpOnly cookie via next/headers.
 * Use inside Server Components, Route Handlers, and Server Actions.
 *
 * When an authenticated call returns 401, this transparently exchanges the
 * refresh-token cookie for a fresh pair and replays the request exactly once.
 * This is the secondary safety net; the middleware renews proactively first.
 */
export async function serverFetch<T>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value ?? null
  const url = buildUrl(path, init.query)

  try {
    return await rawFetch<T>(url, init, token)
  } catch (err) {
    // A 401 is recoverable whenever a refresh cookie is still present — even if
    // the access-token cookie was already evicted (its maxAge is shorter than
    // the refresh cookie's). That eviction is exactly the polling-past-expiry
    // case the refreshable gate lets through, so we must not require `token`.
    if (!(err instanceof ApiError) || err.status !== 401) throw err

    const { REFRESH_COOKIE_NAME, refreshCookieOptions, sessionCookieOptions } =
      await import('@/lib/auth/cookie')
    const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value
    if (!refreshToken) throw err

    let pair: LoginResponse
    try {
      pair = await dedupedRefresh(refreshToken)
    } catch {
      // Refresh failed (expired/reused token): propagate the original 401.
      throw err
    }

    // Persist the rotated pair. cookies().set works in Route Handlers/Server
    // Actions but throws during a Server Component render — swallow that; the
    // single retry below still uses the fresh token held in memory.
    try {
      store.set(SESSION_COOKIE, pair.access_token, sessionCookieOptions())
      store.set(REFRESH_COOKIE_NAME, pair.refresh_token, refreshCookieOptions())
    } catch (err) {
      // A read-only cookie store during an RSC render is expected — the retry
      // below still uses the in-memory token. Anything else is a real bug.
      if (!isReadOnlyCookieStoreError(err)) throw err
    }

    // Hard loop guard: retry exactly once. A 401 here propagates as-is.
    return rawFetch<T>(url, init, pair.access_token)
  }
}

/**
 * Server-side fetch without the auth cookie. Use for the login proxy.
 */
export async function serverFetchAnonymous<T>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  return rawFetch<T>(buildUrl(path, init.query), init, null)
}

/**
 * Client-side fetch — assumes the destination is a Next route handler that
 * proxies to the backend with the cookie-stored JWT, so no Authorization
 * header is sent from the browser.
 */
export async function clientFetch<T>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  return rawFetch<T>(buildUrl(path, init.query), init, null)
}
