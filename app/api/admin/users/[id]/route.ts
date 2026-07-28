import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getInternalUser, updateInternalUser } from '@/lib/api/admin-users'
import { backendErrorStatus, describeError } from '@/lib/api/errors'
import { canManageRole, getAdminContext } from '@/lib/auth/access'

/**
 * No `revalidateTag` in this handler, deliberately: the staff list is fetched
 * with `cache: 'no-store'` (`fetchUsersPage`), so there is no RSC cache entry
 * to bust — `UserForm` calls `router.refresh()` instead. See the client-only
 * exception in CLAUDE.md.
 */
const PatchBody = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['ATTENDANT', 'KITCHEN', 'MANAGER', 'ADMIN']).optional(),
  businessUnitIds: z.array(z.string().min(1)).optional(),
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
      {
        error: 'Role not allowed for your access level.',
        code: 'role_forbidden',
      },
      { status: 403 },
    )
  }
  try {
    const user = await updateInternalUser(admin, id, {
      email: parsed.email,
      name: parsed.name,
      phone: parsed.phone,
      role: parsed.role,
      businessUnitIds: parsed.businessUnitIds,
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
    if (code === 'unit_change_forbidden') {
      return NextResponse.json(
        { error: describeError(err), code },
        { status: 403 },
      )
    }
    // Not-yet-built is a permanent product state, not a server fault. A 5xx
    // would both count against the error SLO and land the client on
    // `useErrorMessage`'s `status >= 500` branch — "the server is unavailable,
    // try again shortly" — which is the opposite of the truth here.
    if (code === 'profile_edit_unsupported') {
      return NextResponse.json(
        { error: describeError(err), code },
        { status: 409 },
      )
    }
    // Same rule (and same code) the create handler enforces at 400.
    if (code === 'unit_required') {
      return NextResponse.json(
        { error: describeError(err), code },
        { status: 400 },
      )
    }
    // `backendErrorStatus` so a genuine upstream 4xx keeps its status instead
    // of being flattened to 500 and reported as "the server is unavailable".
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
