import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE_NAME,
  clearedSessionCookieOptions,
} from '@/lib/auth/cookie'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
  return res
}
