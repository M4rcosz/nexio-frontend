import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getInternalUser, updateInternalUser } from '@/lib/api/admin-users'
import { ApiError, describeError } from '@/lib/api/errors'
import { canManageRole, getAdminContext } from '@/lib/auth/access'

const PatchBody = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['ATTENDANT', 'KITCHEN', 'MANAGER', 'ADMIN']).optional(),
  businessUnitId: z.string().min(1).nullable().optional(),
})

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id } = await ctx.params
  try {
    const user = await getInternalUser(admin, id)
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const { id } = await ctx.params
  let parsed: z.infer<typeof PatchBody>
  try {
    parsed = PatchBody.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }
  if (parsed.role && !canManageRole(admin.role, parsed.role)) {
    return NextResponse.json(
      { error: 'Role not allowed for your access level.', code: 'role_forbidden' },
      { status: 403 },
    )
  }
  try {
    const user = await updateInternalUser(admin, id, {
      email: parsed.email,
      name: parsed.name,
      phone: parsed.phone,
      role: parsed.role,
      // The backend takes a set of units; the form still picks a single one.
      businessUnitIds:
        parsed.businessUnitId === undefined
          ? undefined
          : parsed.businessUnitId
            ? [parsed.businessUnitId]
            : [],
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (code === 'email_taken') {
      return NextResponse.json(
        { error: describeError(err), code },
        { status: 409 },
      )
    }
    if (code === 'role_forbidden') {
      return NextResponse.json(
        { error: describeError(err), code },
        { status: 403 },
      )
    }
    if (err instanceof ApiError && (err.status === 501 || err.status === 422)) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
