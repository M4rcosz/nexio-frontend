import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createInternalUser, listInternalUsers } from '@/lib/api/admin-users'
import { ApiError, describeError } from '@/lib/api/errors'
import { canManageRole, getAdminContext } from '@/lib/auth/access'

const RoleEnum = z.enum(['ATTENDANT', 'KITCHEN', 'MANAGER', 'ADMIN'])

const CreateBody = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: RoleEnum,
  /** Non-ADMIN roles may be bound to several units. Required (non-empty) for
   * non-ADMIN roles — validated below. */
  businessUnitIds: z.array(z.string().min(1)).optional(),
})

export async function GET(req: Request) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const url = new URL(req.url)
  const roleParam = url.searchParams.get('role')
  const businessUnitId = url.searchParams.get('businessUnitId') ?? undefined
  const search = url.searchParams.get('search') ?? undefined
  const role =
    roleParam && ctx.manageableRoles.includes(roleParam as never)
      ? (roleParam as 'ATTENDANT' | 'KITCHEN' | 'MANAGER' | 'ADMIN')
      : undefined
  try {
    const users = await listInternalUsers(ctx, {
      role,
      businessUnitId,
      search,
    })
    return NextResponse.json({ data: users })
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  let parsed: z.infer<typeof CreateBody>
  try {
    parsed = CreateBody.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }
  if (!canManageRole(ctx.role, parsed.role)) {
    return NextResponse.json(
      {
        error: 'Role not allowed for your access level.',
        code: 'role_forbidden',
      },
      { status: 403 },
    )
  }
  if (
    parsed.role !== 'ADMIN' &&
    (!parsed.businessUnitIds || parsed.businessUnitIds.length === 0)
  ) {
    return NextResponse.json(
      {
        error: 'Business unit is required for this role.',
        code: 'unit_required',
      },
      { status: 400 },
    )
  }
  try {
    const user = await createInternalUser(ctx, {
      username: parsed.username,
      email: parsed.email,
      name: parsed.name,
      phone: parsed.phone,
      password: parsed.password,
      role: parsed.role,
      businessUnitIds: parsed.businessUnitIds ?? [],
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined
    if (code === 'username_taken' || code === 'email_taken') {
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
    if (err instanceof ApiError && err.status === 409) {
      return NextResponse.json(
        {
          error: 'Username, e-mail or phone already in use.',
          code: 'username_taken',
        },
        { status: 409 },
      )
    }
    if (err instanceof ApiError && err.status === 403) {
      return NextResponse.json(
        {
          error: 'Role not allowed for your access level.',
          code: 'role_forbidden',
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
