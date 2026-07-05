import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loginBackend } from '@/lib/api/auth'
import { ApiError, describeError } from '@/lib/api/errors'
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/auth/cookie'

const Body = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
})

/** Best-effort read of the `role` claim from a JWT access token. */
function decodeRole(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part, 'base64url').toString('utf8')
    const payload = JSON.parse(json) as { role?: string }
    return payload.role ?? null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: err instanceof z.ZodError ? err.flatten() : undefined },
      { status: 400 },
    )
  }

  try {
    const { access_token, refresh_token } = await loginBackend(parsed)
    // Surface the role so the client can route staff to their landing page.
    // Decoding is cheap and the token is trusted here (just came from login).
    const role = decodeRole(access_token)
    const res = NextResponse.json({ ok: true, role })
    res.cookies.set(SESSION_COOKIE_NAME, access_token, sessionCookieOptions())
    res.cookies.set(REFRESH_COOKIE_NAME, refresh_token, refreshCookieOptions())
    return res
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    // In the login flow specifically, 401 means the credentials were wrong,
    // not that an existing session expired — handle it here so we don't
    // fall back on describeError's generic "session expired" wording.
    if (status === 401) {
      return NextResponse.json(
        { error: 'Invalid username or password.', code: 'invalid_credentials' },
        { status: 401 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
