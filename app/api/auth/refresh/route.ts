import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { refreshBackend } from '@/lib/api/auth'
import { ApiError, describeError } from '@/lib/api/errors'
import {
  clearedSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/auth/cookie'

/**
 * Exchanges the refresh-token cookie for a fresh pair via `POST /auth/refresh`.
 * The backend rotates refresh tokens, so both cookies are always rewritten.
 * A 401 from the backend (expired/reused token) clears the session entirely.
 */
export async function POST() {
  const store = await cookies()
  const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token.' }, { status: 401 })
  }

  try {
    const { access_token, refresh_token } = await refreshBackend(refreshToken)
    // An empty pair means the refresh silently failed — treat it exactly like a
    // 401: clear the session so the user is sent back to sign in.
    if (!access_token || !refresh_token) {
      const res = NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 },
      )
      res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
      res.cookies.set(REFRESH_COOKIE_NAME, '', clearedSessionCookieOptions())
      return res
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE_NAME, access_token, sessionCookieOptions())
    res.cookies.set(REFRESH_COOKIE_NAME, refresh_token, refreshCookieOptions())
    return res
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    // 401 (expired/reused) and 403 (revoked) both mean the refresh token is no
    // longer usable — clear the session so the user is sent back to sign in.
    if (status === 401 || status === 403) {
      const res = NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 },
      )
      res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
      res.cookies.set(REFRESH_COOKIE_NAME, '', clearedSessionCookieOptions())
      return res
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
