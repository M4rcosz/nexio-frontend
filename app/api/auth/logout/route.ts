import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logoutBackend } from '@/lib/api/auth'
import {
  clearedSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/cookie'

export async function POST() {
  // Best-effort revocation of the refresh token (`POST /auth/logout`). The
  // local cookies are cleared even if the backend call fails — the user asked
  // to leave.
  const store = await cookies()
  const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value
  if (refreshToken) {
    try {
      await logoutBackend(refreshToken)
    } catch {
      // ignore — token may already be expired/revoked
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
  res.cookies.set(REFRESH_COOKIE_NAME, '', clearedSessionCookieOptions())
  return res
}
