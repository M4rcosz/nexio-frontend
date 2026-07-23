import { revalidateTag } from 'next/cache'
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
  if (!ctx) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (ctx.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
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
    // The admin usage report is a tagged server read; without this a
    // freshly changed membership would not show up until the tag expires.
    revalidateTag('ai-memberships')
    return NextResponse.json(membership)
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      // The caller is already known to be ADMIN (gated above), so the only 403
      // the contract defines on this route is "the membership is revoked" —
      // reinstate before adjusting. Coded so the client can say exactly that
      // instead of the generic "no permission".
      return NextResponse.json(
        { error: 'Membership is revoked.', code: 'membership_revoked' },
        { status: 403 },
      )
    }
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
