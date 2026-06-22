import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { SESSION_COOKIE } from '@/lib/api/client'

export const SESSION_COOKIE_NAME = SESSION_COOKIE

export function sessionCookieOptions(maxAgeSeconds = 60 * 30): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export function clearedSessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  }
}
