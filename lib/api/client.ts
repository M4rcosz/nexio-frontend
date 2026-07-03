import { ApiError } from './errors'

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? 'nexio_session'

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3000/api'

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

export const SESSION_COOKIE = SESSION_COOKIE_NAME

type FetchInit = Omit<RequestInit, 'body'> & {
  body?: unknown
  query?: Record<string, string | number | undefined>
  // Next-specific fetch options
  next?: { revalidate?: number | false; tags?: string[] }
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

  const fetchInit: RequestInit = {
    method: init.method ?? 'GET',
    headers,
    cache: init.cache,
    next: init.next,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  }

  let res: Response
  try {
    res = await fetch(url, fetchInit)
  } catch (err) {
    throw new ApiError(
      0,
      null,
      err instanceof Error
        ? `Network failure: ${err.message}`
        : 'Network failure while calling the backend.',
    )
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
 * Server-side fetch — reads JWT from httpOnly cookie via next/headers.
 * Use inside Server Components, Route Handlers, and Server Actions.
 */
export async function serverFetch<T>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value ?? null
  return rawFetch<T>(buildUrl(path, init.query), init, token)
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
