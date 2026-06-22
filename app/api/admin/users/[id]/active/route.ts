import { NextResponse } from 'next/server'
import { z } from 'zod'
import { setInternalUserActive } from '@/lib/api/admin-users'
import { describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

const Body = z.object({ isActive: z.boolean() })

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id } = await ctx.params
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
    const user = await setInternalUserActive(admin, id, parsed.isActive)
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
