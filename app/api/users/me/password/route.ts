import { NextResponse } from 'next/server'
import { z } from 'zod'
import { changeMyPassword } from '@/lib/api/users'
import { ApiError, describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'
import {
  clearedSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/cookie'

// Mirrors the backend ChangeMyPasswordDto: new password 10–128 chars with at
// least 3 character classes (lower/upper/digit/symbol).
const Body = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(10, 'New password must have at least 10 characters.')
    .max(128)
    .refine(
      (v) =>
        [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(v))
          .length >= 3,
      'Use at least 3 of: lowercase, uppercase, digits, symbols.',
    ),
})

export async function PATCH(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }
  try {
    await changeMyPassword(parsed)
    // The backend revokes every session on success — drop the local cookies
    // too so the UI sends the user back to the login screen.
    const res = NextResponse.json({ ok: true, requiresLogin: true })
    res.cookies.set(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions())
    res.cookies.set(REFRESH_COOKIE_NAME, '', clearedSessionCookieOptions())
    return res
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 401) {
      return NextResponse.json(
        { error: 'Current password is incorrect.', code: 'wrong_password' },
        { status: 401 },
      )
    }
    if (status === 422) {
      return NextResponse.json(
        {
          error: 'New password must differ from the current one.',
          code: 'same_password',
        },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
