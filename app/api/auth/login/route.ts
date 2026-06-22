import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loginBackend } from '@/lib/api/auth'
import { ApiError, describeError } from '@/lib/api/errors'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/cookie'

const Body = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
})

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
    const { access_token } = await loginBackend(parsed)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE_NAME, access_token, sessionCookieOptions())
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
