import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCategory } from '@/lib/api/categories'
import { ApiError, describeError } from '@/lib/api/errors'
import { getAdminContext } from '@/lib/auth/access'

// `.strict()` rejects unknown keys (isActive, id, createdAt, …) with a 400 —
// categories are born active; isActive is only editable through PATCH.
const CreateBody = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().min(1).max(255).optional(),
  })
  .strict()

export async function POST(req: Request) {
  const admin = await getAdminContext()
  // ADMIN only, mirroring products: MANAGER cannot manage the catalog taxonomy.
  if (!admin) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  if (admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }

  const raw = await req.json().catch(() => null)

  let parsed: z.infer<typeof CreateBody>
  try {
    parsed = CreateBody.parse(raw)
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
    const category = await createCategory(parsed)
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    const status = err instanceof ApiError ? err.status || 500 : 500
    if (status === 409) {
      return NextResponse.json(
        { error: 'Name already in use.', code: 'name_taken' },
        { status: 409 },
      )
    }
    if (status < 500) {
      return NextResponse.json({ error: describeError(err) }, { status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
