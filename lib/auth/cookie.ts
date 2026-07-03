import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { SESSION_COOKIE } from '@/lib/api/client'

export const SESSION_COOKIE_NAME = SESSION_COOKIE

/** Holds the opaque backend refresh token (rotated on every refresh). */
export const REFRESH_COOKIE_NAME =
  process.env.REFRESH_COOKIE_NAME ?? 'nexio_refresh'

/** Refresh tokens outlive the 30-min access token; keep the cookie for 7 days. */
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function baseOptions(maxAgeSeconds: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export function sessionCookieOptions(maxAgeSeconds = 60 * 30): Partial<ResponseCookie> {
  return baseOptions(maxAgeSeconds)
}

export function refreshCookieOptions(
  maxAgeSeconds = REFRESH_MAX_AGE_SECONDS,
): Partial<ResponseCookie> {
  return baseOptions(maxAgeSeconds)
}

export function clearedSessionCookieOptions(): Partial<ResponseCookie> {
  return baseOptions(0)
}
