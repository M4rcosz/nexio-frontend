import { SESSION_COOKIE } from '@/lib/api/client'
import { REFRESH_COOKIE_NAME } from '@/lib/auth/cookie'

export type SessionPayload = {
  sub: string
  username: string
  role: string
  /** Units the staff user is bound to ([] = unbound). Absent in old tokens. */
  businessUnitIds?: string[]
  iat?: number
  exp?: number
}

/**
 * Decodes a base64url JWT segment to a UTF-8 string using only Web APIs
 * (`atob`/`TextDecoder`) so it works on the Next edge runtime — where Node's
 * `Buffer` is not guaranteed — as well as in Node 20.
 */
function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodePayload(token: string): SessionPayload | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(base64UrlDecode(part)) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Single source of truth for token expiry, usable on the edge (no
 * `next/headers`). A missing, malformed, or `exp`-less token is treated as
 * expired — failing safe so callers renew or re-auth instead of trusting an
 * unverifiable token. `skewSeconds` renews slightly early to avoid racing the
 * exact expiry moment; pass `0` for an exact gate.
 */
export function isTokenExpired(
  token: string | undefined,
  skewSeconds = 30,
): boolean {
  if (!token) return true
  const payload = decodePayload(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
}

export async function getSession(): Promise<SessionPayload | null> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  // Exact expiry gate (skew=0): the middleware owns proactive renewal with a
  // 30s skew, so here we only trust a token that is genuinely still valid.
  if (!token || isTokenExpired(token, 0)) return null
  return decodePayload(token)
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}

/**
 * Gate for polling route handlers that live outside the middleware matcher
 * (e.g. `/api/orders/[id]`), where the proactive refresh never runs. Returns
 * true when there is a still-valid session OR a refresh cookie we can spend: in
 * the latter case the request is let through so the downstream `serverFetch`
 * can turn the backend 401 into a refresh+retry (route handlers can persist the
 * rotated cookie). Only when neither a valid session nor a refresh token exists
 * do we reject up front — the backend still authorizes the Bearer, and
 * `serverFetch` propagates the 401 if the refresh token turns out to be invalid.
 */
export async function hasActiveOrRefreshableSession(): Promise<boolean> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token && !isTokenExpired(token, 0)) return true
  return Boolean(store.get(REFRESH_COOKIE_NAME)?.value)
}
