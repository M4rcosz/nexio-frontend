import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { setWorkflowEnabled, workflowTags } from '@/lib/api/workflow'
import {
  toWorkflowError,
  workflowErrorResponse,
} from '@/lib/api/workflow/errors'
import { getAdminContext } from '@/lib/auth/access'

/**
 * The enabled flag as its own sub-resource — `POST`, matching the repo's other
 * toggle of this shape (`/api/business-units/:id/active`). It forwards to the service's
 * `activateWorkflow`/`deactivateWorkflow` shortcuts rather than a partial
 * update (§4), which also keeps the toggle clear of the redaction trap: no node
 * payload is sent, so there is no masked credential to send back (§2.1).
 *
 * Resource-shaped on purpose. A `/graphql` passthrough would turn this
 * authenticated same-origin route into an open gateway onto a service that
 * authenticates nothing yet (§9) — the document is chosen here, and only the
 * variables come from the request.
 */
const Body = z.object({ enabled: z.boolean() })

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext()
  // ADMIN only, and checked here as well as on the page: a workflow calls out to
  // arbitrary third parties with stored credentials, so it is not a MANAGER's to
  // start or stop. `shellTier()` is presentation only and gates nothing.
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden.', code: 'forbidden' },
      { status: 403 },
    )
  }

  const { id } = await ctx.params
  const raw = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const workflow = await setWorkflowEnabled(id, parsed.data.enabled)
    // Both workflow lists are RSC-rendered from tagged, uncached reads, so the
    // CLAUDE.md "client-only list" exception does not apply — without these the
    // list and the detail page keep showing the old flag.
    revalidateTag(workflowTags.all)
    revalidateTag(workflowTags.one(id))
    // Safe to echo: the activate/deactivate documents select `nodes { id }`
    // only, so no header, body or url — masked or not — travels in this
    // response.
    return NextResponse.json(workflow)
  } catch (err) {
    // One mapper for both the live service and the mock, which throws the same
    // classifications. `fieldMessage` is populated for BAD_REQUEST only.
    const { status, code, fieldMessage } = workflowErrorResponse(
      toWorkflowError(err),
    )
    return NextResponse.json(
      { error: 'Could not change the workflow status.', code, fieldMessage },
      { status },
    )
  }
}
