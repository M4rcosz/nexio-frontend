import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enrollAiMembership } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'
import { AI_TOKEN_MAX, AI_TOKEN_MIN } from '@/lib/validation/constants'

// Enroll/adjust are ADMIN-only per the contract (MANAGER gets a backend 403).
const Body = z.object({
  initialBalance: z.number().int().min(AI_TOKEN_MIN).max(AI_TOKEN_MAX),
})

export async function POST(
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
    const membership = await enrollAiMembership(userId, parsed.initialBalance)
    return NextResponse.json(membership, { status: 201 })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // Already enrolled — the client falls back to the adjust (PATCH) flow.
      return NextResponse.json(
        {
          error: 'User already has an AI membership.',
          code: 'already_enrolled',
        },
        { status: 409 },
      )
    }
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json(
        { error: 'User not found.', code: 'user_not_found' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
