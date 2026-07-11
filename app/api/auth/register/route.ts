import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loginBackend, registerCustomer } from '@/lib/api/auth'
import { ApiError, describeError } from '@/lib/api/errors'
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/auth/cookie'
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
} from '@/lib/validation/constants'
import { usernameSchema } from '@/lib/validation/username'
import { passwordSchema } from '@/lib/validation/password'

// Mirrors the backend RegisterCustomerDto: username is the (strict, non-folded)
// login key, email is required, phone optional, and there is no role field
// (forced to CUSTOMER server-side).
const Body = z.object({
  name: z.string().min(2, 'Please provide your name.').max(NAME_MAX_LENGTH),
  username: usernameSchema,
  email: z.string().email('Invalid e-mail.').max(EMAIL_MAX_LENGTH),
  password: passwordSchema,
  phone: z.string().max(PHONE_MAX_LENGTH).optional(),
})

export async function POST(req: Request) {
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

  // 1. Create the account.
  try {
    await registerCustomer(parsed)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        {
          error: 'Username, e-mail or phone already in use.',
          code: 'already_exists',
        },
        { status: 409 },
      )
    }
    if (status === 429) {
      return NextResponse.json(
        {
          error: 'Too many attempts. Please try again in a minute.',
          code: 'rate_limited',
        },
        { status: 429 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }

  // 2. Registration returns no token — sign the new customer in with the same
  // credentials so they land authenticated, matching the previous UX.
  try {
    const { access_token, refresh_token } = await loginBackend({
      username: parsed.username,
      password: parsed.password,
    })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE_NAME, access_token, sessionCookieOptions())
    res.cookies.set(REFRESH_COOKIE_NAME, refresh_token, refreshCookieOptions())
    return res
  } catch {
    // The account exists; only the auto-login failed. Tell the client to send
    // the user to the login screen instead of pretending they are signed in.
    return NextResponse.json({ ok: true, requiresLogin: true })
  }
}
