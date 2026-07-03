import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateMe } from '@/lib/api/users'
import { ApiError, describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

// Mirrors the backend UpdateMeDto: at least one of name/phone.
const Body = z
  .object({
    name: z.string().min(2).max(120).optional(),
    phone: z.string().max(20).optional(),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined, {
    message: 'Provide at least one field to update.',
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
      { error: 'Invalid payload.', details: err instanceof z.ZodError ? err.flatten() : undefined },
      { status: 400 },
    )
  }
  try {
    const user = await updateMe(parsed)
    return NextResponse.json(user)
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        { error: 'Phone already in use.', code: 'phone_taken' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: status >= 500 ? 502 : status },
    )
  }
}
