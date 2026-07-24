import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createInternalUser, listInternalUsers } from '@/lib/api/admin-users'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { parseLimit } from '@/lib/api/pagination'
import { canManageRole, getAdminContext } from '@/lib/auth/access'
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
} from '@/lib/validation/constants'
import { usernameSchema } from '@/lib/validation/username'
import { passwordSchema } from '@/lib/validation/password'

// KEEP the existing role enum (with KITCHEN) unchanged.
const RoleEnum = z.enum(['ATTENDANT', 'KITCHEN', 'MANAGER', 'ADMIN'])

// Listing filters. Validated locally so a malformed value is a 400 here rather
// than a wasted round-trip that comes back as an unactionable generic upstream
// 400. Bounds mirror the contract (§1.2): businessUnitId is a uuid,
// username ≤50, email ≤120. `role` spans all five contract roles — CUSTOMER is
// well-formed input that this route simply never honours (see below).
//
// `cursor` is an opaque keyset token, NOT a row id — never type it as a uuid,
// which would reject every real cursor before it is ever sent. The only bound
// worth enforcing is the backend's 512-char cap.
const ListQuery = z.object({
  role: z
    .enum(['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN', 'CUSTOMER'])
    .optional(),
  businessUnitId: z.string().uuid().optional(),
  search: z.string().max(50).optional(),
  email: z.string().max(120).optional(),
  cursor: z.string().max(512).optional(),
})

const CreateBody = z.object({
  username: usernameSchema,
  email: z.string().email().max(EMAIL_MAX_LENGTH),
  name: z.string().min(2).max(NAME_MAX_LENGTH),
  phone: z.string().max(PHONE_MAX_LENGTH).optional(),
  password: passwordSchema,
  role: RoleEnum,
  /** Non-ADMIN roles may be bound to several units. Required (non-empty) for
   * non-ADMIN roles — validated below. Ids must be unique uuids. */
  businessUnitIds: z
    .array(z.string().uuid())
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Duplicate business unit.',
    )
    .optional(),
})

export async function GET(req: Request) {
  const ctx = await getAdminContext()
  // `getAdminContext()` returns null both for an absent/expired session and
  // for a role that is not ADMIN/MANAGER. Contract §0 separates them (401 vs
  // 403) and the client keys its re-auth prompt off 401, so collapsing both
  // into 403 leaves a lapsed staff user staring at "Forbidden" with no way
  // back. Mirrors the customers route.
  if (!ctx) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
  }
  const url = new URL(req.url)

  let query: z.infer<typeof ListQuery>
  try {
    query = ListQuery.parse({
      role: url.searchParams.get('role') ?? undefined,
      businessUnitId: url.searchParams.get('businessUnitId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      email: url.searchParams.get('email') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid query.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }

  // Validation above answers a *malformed* role with 400 (contract §1.2). This
  // is the separate, deliberate step: a well-formed role the actor may not
  // manage is dropped rather than forwarded, so it cannot be used to list rows
  // outside their level. Conflating the two would turn a typo into a silent
  // full-list response.
  const role =
    query.role && ctx.manageableRoles.includes(query.role)
      ? query.role
      : undefined
  const limit = parseLimit(url.searchParams.get('limit'))
  const { businessUnitId, search, email, cursor } = query
  try {
    // Returns the backend's `{ data, meta }` envelope untouched — `meta` is
    // what the Load more control needs to ask for the next cursor.
    const page = await listInternalUsers(ctx, {
      role,
      businessUnitId,
      search,
      email,
      limit,
      cursor,
    })
    return NextResponse.json(page)
  } catch (err) {
    // A MANAGER probing a unit outside their claim is answered 404 by the
    // backend, deliberately, so it cannot be used to enumerate units. Pass
    // that through as a plain not-found; never reword it as a permission
    // error, which would leak exactly what the 404 hides (docs §1.3).
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    // A stale or malformed keyset cursor is 422, not 400. Tag it so the client
    // drops the cursor and restarts from page 1 instead of retrying a token
    // that can only ever fail again.
    if (err instanceof ApiError && err.status === 422) {
      return NextResponse.json(
        {
          error: 'The list changed. Reset to the first page.',
          code: 'invalid_cursor',
        },
        { status: 422 },
      )
    }
    // `backendErrorStatus` normalizes `err.status || 500` before comparing.
    // Testing `err.status < 500` directly is wrong: `serverFetch` throws
    // `ApiError(0, …)` on a network failure or the 4s timeout, and `0 < 500`
    // would hand `NextResponse.json` a status of 0 — outside the legal
    // 200..599 range, so it throws a RangeError and the client gets an opaque
    // framework 500 exactly when the backend is down.
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}

export async function POST(req: Request) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json(
      { error: 'Session expired.', code: 'session_expired' },
      { status: 401 },
    )
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
