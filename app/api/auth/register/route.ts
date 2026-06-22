// [stub] backend does not implement /auth/register — this is a mock that
// signs the user in locally.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { registerStub } from '@/lib/api/auth'
import { describeError } from '@/lib/api/errors'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/cookie'

const Body = z.object({
  username: z.string().min(3, 'Username is too short.'),
  email: z.string().email('Invalid e-mail.'),
  password: z.string().min(8, 'Password must have at least 8 characters.'),
  name: z.string().min(2, 'Please provide your name.'),
  phone: z.string().optional(),
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
    const { access_token } = await registerStub(parsed)
    const res = NextResponse.json({ ok: true, stub: true })
    res.cookies.set(SESSION_COOKIE_NAME, access_token, sessionCookieOptions())
    return res
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
