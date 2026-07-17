import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adjustAiMembershipBalance } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { AI_TOKEN_MAX } from '@/lib/validation/constants'

const Body = z.object({
  delta: z
    .number()
    .int()
    .min(-AI_TOKEN_MAX)
    .max(AI_TOKEN_MAX)
    .refine((n) => n !== 0, 'Delta must be non-zero.'),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getAdminContext()
  if (!ctx || ctx.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { userId } = await params

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
    const membership = await adjustAiMembershipBalance(userId, parsed.delta)
    if (!membership) {
      // Not enrolled yet — the admin must POST an initial grant first.
      return NextResponse.json(
        { error: 'User is not enrolled.', code: 'not_enrolled' },
        { status: 404 },
      )
    }
    return NextResponse.json(membership)
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      // Below zero or overflow. Keyed by a stable code — the client shows a
      // translated message rather than echoing the raw backend text.
      return NextResponse.json(
        { error: 'Balance out of range.', code: 'balance_out_of_range' },
        { status: 422 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
